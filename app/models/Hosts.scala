package models

import javax.inject.Singleton

import com.google.inject.{ImplementedBy, Inject}
import play.api.Configuration
import play.api.libs.json.{JsArray, JsObject, Json}

import scala.jdk.CollectionConverters._
import scala.util.{Failure, Success, Try}

case class HostBookmark(name: String, host: String)

@ImplementedBy(classOf[HostsImpl])
trait Hosts {

  def getHostNames(): Seq[String]

  def getBookmarks(): Seq[HostBookmark]

  def getHost(name: String): Option[Host]

  def bookmarksJson: JsArray

}

@Singleton
class HostsImpl @Inject()(config: Configuration) extends Hosts {

  private val parsed: Seq[(String, Host)] = Try(config.underlying.getConfigList("hosts").asScala.map(Configuration(_))) match {
    case Success(hostsConf) => hostsConf.flatMap { hostConf =>
      hostConf.getOptional[String]("host").map { host =>
        val name = hostConf.getOptional[String]("name").getOrElse(host)
        // Credentials in config remain optional legacy; connect-time credentials are preferred.
        val username = hostConf.getOptional[String]("auth.username")
        val password = hostConf.getOptional[String]("auth.password")
        val headersWhitelist = hostConf.getOptional[Seq[String]]("headers-whitelist").getOrElse(Seq.empty[String])
        val auth = (username, password) match {
          case (Some(u), Some(p)) => Some(OpenSearchAuth(u, p))
          case _                  => None
        }
        name -> Host(host, auth, headersWhitelist, None)
      }
    }.toSeq
    case Failure(_) => Seq.empty
  }

  private val hosts: Map[String, Host] = parsed.toMap

  def getHostNames(): Seq[String] = getBookmarks().map(_.name)

  def getBookmarks(): Seq[HostBookmark] =
    parsed.map { case (name, host) => HostBookmark(name, host.name) }

  def getHost(name: String): Option[Host] =
    hosts.get(name).orElse(hosts.values.find(_.name == name))

  def bookmarksJson: JsArray = JsArray(getBookmarks().map { b =>
    Json.obj("name" -> b.name, "host" -> b.host)
  })
}
