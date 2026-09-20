package models

import controllers.auth.AuthRequest
import exceptions.{MissingRequiredParamException, MissingTargetHostException}
import models.security.{HostInvalid, HostValid, HostValidator}
import play.api.libs.json.{JsArray, JsObject, JsValue}

case class CerebroRequest(val target: OpenSearchServer, body: JsValue, val user: Option[User]) {

  def get(name: String) =
    (body \ name).asOpt[String].getOrElse(throw MissingRequiredParamException(name))

  def getOpt(name: String) =
    (body \ name).asOpt[String]

  def getInt(name: String) =
    (body \ name).asOpt[Int].getOrElse(throw MissingRequiredParamException(name))

  def getBoolean(name: String) =
    (body \ name).asOpt[Boolean].getOrElse(throw MissingRequiredParamException(name))

  def getArray(name: String) = (body \ name).asOpt[Array[String]].getOrElse(throw MissingRequiredParamException(name))

  def getObj(name: String) =
    (body \ name).asOpt[JsObject].getOrElse(throw MissingRequiredParamException(name))

  def getObjOpt(name: String) =
    (body \ name).asOpt[JsValue]

  def getOptArray(name: String): Option[JsArray] =
    (body \ name).asOpt[JsArray]

  def getAsStringArray(name: String): Option[Array[String]] =
    (body \ name).asOpt[Array[String]]

}

object CerebroRequest {

  def apply(request: AuthRequest[JsValue], hosts: Hosts): CerebroRequest =
    apply(request, hosts, None)

  def apply(request: AuthRequest[JsValue], hosts: Hosts, validator: Option[HostValidator]): CerebroRequest = {
    val body = request.body

    val hostName = (body \ "host").asOpt[String].map(_.trim).filter(_.nonEmpty)
      .getOrElse(throw MissingTargetHostException)
    val username = (body \ "username").asOpt[String].filter(_.nonEmpty)
    val password = (body \ "password").asOpt[String]
    val clientCert = (body \ "client_cert").asOpt[String].filter(_.nonEmpty)
    val clientKey = (body \ "client_key").asOpt[String].filter(_.nonEmpty)
    val caCert = (body \ "ca_cert").asOpt[String].filter(_.nonEmpty)
    val strictCaCheck = (body \ "strict_ca_check").asOpt[Boolean].getOrElse(true)

    val requestAuth = (username, password) match {
      case (Some(u), Some(p)) => Some(OpenSearchAuth(u, p))
      case (Some(u), None)    => Some(OpenSearchAuth(u, ""))
      case _                  => None
    }

    val requestTls = (clientCert, clientKey, caCert) match {
      case (Some(cert), Some(key), ca) =>
        Some(ClientTls(clientCertPem = Some(cert), clientKeyPem = Some(key), caCertPem = ca,
          strictCaCheck = strictCaCheck))
      case (None, None, Some(ca)) =>
        Some(ClientTls(caCertPem = Some(ca), strictCaCheck = strictCaCheck))
      case (Some(_), None, _) | (None, Some(_), _) =>
        throw new IllegalArgumentException("client_cert and client_key must both be provided for mTLS")
      case _ =>
        if (strictCaCheck) None else Some(ClientTls(strictCaCheck = false))
    }

    val server = hosts.getHost(hostName) match {
      case Some(host @ Host(h, a, headersWhitelist, tls)) =>
        validator.foreach(v => validateOrThrow(v, h))
        val headers = headersWhitelist.flatMap(headerName => request.headers.get(headerName).map(headerName -> _))
        OpenSearchServer(
          host.copy(
            authentication = requestAuth.orElse(a),
            tls = requestTls.orElse(tls)
          ),
          headers
        )
      case None =>
        validator.foreach(v => validateOrThrow(v, hostName))
        OpenSearchServer(Host(hostName, requestAuth, Seq.empty, requestTls))
    }

    CerebroRequest(server, body, request.user)
  }

  private def validateOrThrow(validator: HostValidator, host: String): Unit =
    validator.validate(host) match {
      case HostValid => ()
      case HostInvalid(reason) => throw new IllegalArgumentException(reason)
    }
}
