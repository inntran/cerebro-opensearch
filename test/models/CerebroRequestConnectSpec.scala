package models

import controllers.auth.AuthRequest
import models.security.HostValidator
import org.specs2.mutable.Specification
import org.specs2.mock.Mockito
import play.api.Configuration
import play.api.libs.json.{JsValue, Json}
import play.api.mvc.Headers
import com.typesafe.config.ConfigFactory

class CerebroRequestConnectSpec extends Specification with Mockito {

  private def validator = new HostValidator(Configuration(ConfigFactory.parseString(
    """
      |security.block_private_networks = false
      |security.allowed_schemes = ["http", "https"]
      |""".stripMargin)))

  private def hostsMock(host: Option[Host] = None) = {
    val hosts = mock[Hosts]
    hosts.getHost(anyString) returns host
    hosts
  }

  "CerebroRequest" should {
    "accept connect-time basic auth for an ad-hoc host" in {
      val body = Json.obj(
        "host" -> "https://os.example:9200",
        "username" -> "admin",
        "password" -> "s3cret"
      )
      val request = mock[AuthRequest[JsValue]]
      request.body returns body
      request.headers returns Headers()
      request.user returns None

      val req = CerebroRequest(request, hostsMock(), Some(validator))
      req.target.host.name mustEqual "https://os.example:9200"
      req.target.host.authentication must beSome(OpenSearchAuth("admin", "s3cret"))
      req.target.host.tls must beNone
    }

    "accept mTLS PEM fields without basic auth" in {
      val body = Json.obj(
        "host" -> "https://os.example:9200",
        "client_cert" -> "test-client-cert-pem",
        "client_key" -> "test-client-key-pem",
        "ca_cert" -> "test-ca-cert-pem"
      )
      val request = mock[AuthRequest[JsValue]]
      request.body returns body
      request.headers returns Headers()
      request.user returns None

      val req = CerebroRequest(request, hostsMock(), Some(validator))
      req.target.host.tls must beSome.which { tls =>
        tls.clientCertPem must beSome("test-client-cert-pem")
        tls.clientKeyPem must beSome("test-client-key-pem")
        tls.caCertPem must beSome("test-ca-cert-pem")
      }
    }

    "accept CA-only PEM for custom server trust without client identity" in {
      val body = Json.obj(
        "host" -> "https://os.example:9200",
        "ca_cert" -> "test-ca-cert-pem"
      )
      val request = mock[AuthRequest[JsValue]]
      request.body returns body
      request.headers returns Headers()
      request.user returns None

      val req = CerebroRequest(request, hostsMock(), Some(validator))
      req.target.host.tls must beSome.which { tls =>
        tls.hasClientIdentity must beFalse
        tls.hasCustomTrust must beTrue
        tls.caCertPem must beSome("test-ca-cert-pem")
      }
    }

    "allow an explicitly untrusted HTTPS connection without PEM material" in {
      val request = mock[AuthRequest[JsValue]]
      request.body returns Json.obj("host" -> "https://os.example:9200", "strict_ca_check" -> false)
      request.headers returns Headers()
      request.user returns None

      val req = CerebroRequest(request, hostsMock(), Some(validator))
      req.target.host.tls must beSome.which(_.strictCaCheck must beFalse)
    }

    "keep strict verification when the toggle is enabled" in {
      val request = mock[AuthRequest[JsValue]]
      request.body returns Json.obj("host" -> "https://os.example:9200", "strict_ca_check" -> true)
      request.headers returns Headers()
      request.user returns None

      val req = CerebroRequest(request, hostsMock(), Some(validator))
      req.target.host.tls must beNone
    }

    "prefer request credentials over bookmark auth" in {
      val bookmark = Host("https://os.example:9200", Some(OpenSearchAuth("bookmark", "old")), Seq.empty, None)
      val body = Json.obj(
        "host" -> "named",
        "username" -> "admin",
        "password" -> "new"
      )
      val request = mock[AuthRequest[JsValue]]
      request.body returns body
      request.headers returns Headers()
      request.user returns None

      val hosts = mock[Hosts]
      hosts.getHost("named") returns Some(bookmark)

      val req = CerebroRequest(request, hosts, Some(validator))
      req.target.host.authentication must beSome(OpenSearchAuth("admin", "new"))
    }

    "reject invalid hosts when a validator is provided" in {
      val body = Json.obj("host" -> "file:///etc/passwd")
      val request = mock[AuthRequest[JsValue]]
      request.body returns body
      request.headers returns Headers()
      request.user returns None

      CerebroRequest(request, hostsMock(), Some(validator)) must throwA[IllegalArgumentException]
    }
  }
}
