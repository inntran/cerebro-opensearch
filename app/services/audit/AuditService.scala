package services.audit

import java.nio.charset.StandardCharsets
import java.nio.file.{Files, Path, Paths, StandardOpenOption}
import java.time.Instant

import com.google.inject.{ImplementedBy, Inject, Singleton}
import play.api.Configuration
import play.api.libs.json.{JsObject, JsString, Json}

@ImplementedBy(classOf[FileAuditService])
trait AuditService {
  def enabled: Boolean
  def record(event: String, fields: Map[String, String]): Unit
}

@Singleton
class FileAuditService @Inject()(config: Configuration) extends AuditService {

  private val log = org.slf4j.LoggerFactory.getLogger(classOf[FileAuditService])

  override val enabled: Boolean =
    config.getOptional[Boolean]("audit.enabled").getOrElse(false) ||
      sys.env.get("CEREBRO_AUDIT").exists(v => v.equalsIgnoreCase("true") || v == "1")

  private lazy val auditPath: Path = {
    val data = Paths.get(config.getOptional[String]("data.path").getOrElse("./data"))
    Files.createDirectories(data)
    data.resolve("audit.log")
  }

  override def record(event: String, fields: Map[String, String]): Unit = {
    if (!enabled) return
    val sanitized = fields.map {
      case (k, _) if SensitiveKeys.contains(k.toLowerCase) => k -> "<redacted>"
      case other => other
    }
    val fieldsJson = JsObject(sanitized.map { case (k, v) => k -> JsString(v) }.toSeq)
    val payload = Json.obj("ts" -> Instant.now().toString, "event" -> event) ++ fieldsJson
    try {
      Files.write(
        auditPath,
        (Json.stringify(payload) + "\n").getBytes(StandardCharsets.UTF_8),
        StandardOpenOption.CREATE,
        StandardOpenOption.APPEND
      )
    } catch {
      case e: Exception => log.warn(s"Failed to write audit event $event: ${e.getMessage}")
    }
  }

  private val SensitiveKeys = Set(
    "password", "secret", "client_key", "client_cert", "ca_cert", "authorization", "credentials"
  )
}
