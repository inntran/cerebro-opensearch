package models.security

import java.net.{InetAddress, URI, URL}

import play.api.Configuration

import scala.util.Try

sealed trait HostValidation
case object HostValid extends HostValidation
case class HostInvalid(reason: String) extends HostValidation

class HostValidator(config: Configuration) {

  private val allowedSchemes: Set[String] =
    config.getOptional[Seq[String]]("security.allowed_schemes").getOrElse(Seq("http", "https")).map(_.toLowerCase).toSet

  private val blockPrivate: Boolean =
    config.getOptional[Boolean]("security.block_private_networks").getOrElse(false)

  def validate(raw: String): HostValidation = {
    val trimmed = Option(raw).map(_.trim).getOrElse("")
    if (trimmed.isEmpty) return HostInvalid("host is required")
    if (trimmed.contains("@")) return HostInvalid("credentials in URL are not allowed; use username/password fields")

    val uri = Try(new URI(trimmed)).toOption.getOrElse(return HostInvalid("invalid URL"))
    val scheme = Option(uri.getScheme).map(_.toLowerCase).getOrElse("")
    if (!allowedSchemes.contains(scheme)) return HostInvalid(s"scheme must be one of ${allowedSchemes.mkString(", ")}")
    if (uri.getHost == null || uri.getHost.isEmpty) return HostInvalid("URL must include a host")
    if (uri.getUserInfo != null) return HostInvalid("credentials in URL are not allowed")

    if (blockPrivate) {
      validateRemoteHost(uri.getHost) match {
        case Some(reason) => return HostInvalid(reason)
        case None => ()
      }
    }
    HostValid
  }

  private def validateRemoteHost(host: String): Option[String] = {
    val lowered = host.toLowerCase
    if (lowered == "localhost" || lowered.endsWith(".localhost") || lowered.endsWith(".local")) {
      return Some("private/local addresses are blocked")
    }
    Try(InetAddress.getAllByName(host)).toOption.toSeq.flatten.foreach { addr =>
      if (addr.isAnyLocalAddress || addr.isLoopbackAddress || addr.isLinkLocalAddress ||
        addr.isSiteLocalAddress || addr.isMulticastAddress || isMetadata(addr)) {
        return Some("private/link-local/metadata addresses are blocked")
      }
    }
    None
  }

  private def isMetadata(addr: InetAddress): Boolean = {
    val ip = addr.getHostAddress
    ip == "169.254.169.254" || ip.startsWith("fd00:ec2::")
  }
}
