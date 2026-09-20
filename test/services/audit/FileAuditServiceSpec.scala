package services.audit

import java.nio.file.{Files, Paths}

import com.typesafe.config.ConfigFactory
import org.specs2.mutable.Specification
import play.api.Configuration
import play.api.libs.json.Json

class FileAuditServiceSpec extends Specification {

  "FileAuditService" should {
    "be disabled by default" in {
      val svc = new FileAuditService(Configuration(ConfigFactory.parseString("")))
      svc.enabled must beFalse
    }

    "write redacted JSON lines when enabled" in {
      val dir = Files.createTempDirectory("cerebro-audit-test")
      val conf = Configuration(ConfigFactory.parseString(
        s"""
           |audit.enabled = true
           |data.path = "${dir.toAbsolutePath}"
           |""".stripMargin))
      val svc = new FileAuditService(conf)
      svc.enabled must beTrue
      svc.record("connect", Map(
        "host" -> "https://os.example:9200",
        "password" -> "s3cret",
        "client_key" -> "pem-material-should-be-redacted"
      ))

      val log = dir.resolve("audit.log")
      Files.exists(log) must beTrue
      val line = Files.readString(log).trim
      val json = Json.parse(line)
      (json \ "event").as[String] mustEqual "connect"
      (json \ "host").as[String] mustEqual "https://os.example:9200"
      (json \ "password").as[String] mustEqual "<redacted>"
      (json \ "client_key").as[String] mustEqual "<redacted>"
      line must not contain "s3cret"
    }

    "no-op when disabled" in {
      val dir = Files.createTempDirectory("cerebro-audit-off")
      val conf = Configuration(ConfigFactory.parseString(
        s"""
           |audit.enabled = false
           |data.path = "${dir.toAbsolutePath}"
           |""".stripMargin))
      val svc = new FileAuditService(conf)
      svc.record("connect", Map("host" -> "https://os.example:9200"))
      Files.exists(dir.resolve("audit.log")) must beFalse
    }
  }
}
