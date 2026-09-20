package models.security

import org.specs2.mutable.Specification
import play.api.Configuration
import com.typesafe.config.ConfigFactory

class HostValidatorSpec extends Specification {

  private def validator(blockPrivate: Boolean) = {
    val conf = Configuration(ConfigFactory.parseString(
      s"""
         |security.block_private_networks = $blockPrivate
         |security.allowed_schemes = ["http", "https"]
         |""".stripMargin))
    new HostValidator(conf)
  }

  "HostValidator" should {
    "accept https URLs" in {
      validator(false).validate("https://opensearch.example:9200") must beEqualTo(HostValid)
    }
    "reject credentials in URL" in {
      validator(false).validate("https://user:pass@opensearch.example:9200") must beAnInstanceOf[HostInvalid]
    }
    "reject non-http schemes" in {
      validator(false).validate("file:///etc/passwd") must beAnInstanceOf[HostInvalid]
    }
    "block localhost when configured" in {
      validator(true).validate("http://localhost:9200") must beAnInstanceOf[HostInvalid]
    }
  }
}
