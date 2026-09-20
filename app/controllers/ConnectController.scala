package controllers

import javax.inject.Inject

import controllers.auth.AuthenticationModule
import opensearch.OpenSearchClient
import models.security.{HostInvalid, HostValid, HostValidator}
import models.{CerebroRequest, CerebroResponse, Hosts}
import play.api.Configuration
import play.api.libs.json.Json
import play.api.mvc.InjectedController
import services.audit.AuditService

import scala.concurrent.ExecutionContext.Implicits.global

class ConnectController @Inject()(val authentication: AuthenticationModule,
                                  opensearch: OpenSearchClient,
                                  hosts: Hosts,
                                  configuration: Configuration,
                                  audit: AuditService) extends InjectedController with AuthSupport {

  private val validator = new HostValidator(configuration)

  def index = AuthAction(authentication)(defaultExecutionContext) { _ =>
    CerebroResponse(200, Json.toJson(hosts.getHostNames()))
  }

  def connect = AuthAction(authentication)(defaultExecutionContext).async(parse.json) { request =>
    try {
      val req = CerebroRequest(request, hosts, Some(validator))
      val hostUrl = req.target.host.name
      validator.validate(hostUrl) match {
        case HostInvalid(reason) =>
          audit.record("connect_denied", Map("host" -> hostUrl, "reason" -> reason))
          scala.concurrent.Future.successful(CerebroResponse(400, Json.obj("error" -> reason)))
        case HostValid =>
          opensearch.executeRequest("GET", "_cluster/health", None, req.target).map { response =>
            val user = req.target.host.authentication.map(_.username).getOrElse("anonymous")
            if (response.status >= 200 && response.status < 300) {
              audit.record("connect", Map(
                "host" -> hostUrl,
                "user" -> user,
                "status" -> response.status.toString,
                "result" -> "ok"
              ))
            } else {
              audit.record("connect", Map(
                "host" -> hostUrl,
                "user" -> user,
                "status" -> response.status.toString,
                "result" -> "failed"
              ))
            }
            CerebroResponse(response.status, response.body)
          }
      }
    } catch {
      case e: IllegalArgumentException =>
        scala.concurrent.Future.successful(CerebroResponse(400, Json.obj("error" -> e.getMessage)))
      case e: Exception =>
        scala.concurrent.Future.successful(CerebroResponse(400, Json.obj("error" -> e.getMessage)))
    }
  }

}
