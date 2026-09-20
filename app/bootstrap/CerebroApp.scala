package bootstrap

import java.nio.charset.StandardCharsets
import java.nio.file.{Files, Path, Paths, StandardOpenOption}
import java.security.SecureRandom
import java.util.Base64

/** Ensures a durable HTTP secret and data directory before Play boots. */
object SecretBootstrap {

  private val EnvSecretKeys = Seq("CEREBRO_SECRET", "PLAY_HTTP_SECRET_KEY")

  def ensure(): Path = {
    val dataDir = Paths.get(
      sys.props.get("data.path")
        .orElse(sys.env.get("CEREBRO_DATA"))
        .getOrElse("./data")
    ).toAbsolutePath.normalize()
    Files.createDirectories(dataDir)

    val existingEnv = EnvSecretKeys.flatMap(k => sys.env.get(k).filter(_.nonEmpty)).headOption
    val secret = existingEnv.getOrElse {
      val secretFile = dataDir.resolve("http.secret")
      if (Files.isRegularFile(secretFile)) {
        new String(Files.readAllBytes(secretFile), StandardCharsets.UTF_8).trim
      } else {
        val generated = generateSecret()
        Files.write(
          secretFile,
          generated.getBytes(StandardCharsets.UTF_8),
          StandardOpenOption.CREATE_NEW,
          StandardOpenOption.WRITE
        )
        generated
      }
    }

    if (sys.props.get("play.http.secret.key").forall(s => s.isEmpty || s.contains("changeme"))) {
      sys.props += "play.http.secret.key" -> secret
    }
    if (sys.props.get("data.path").isEmpty) {
      sys.props += "data.path" -> dataDir.toString
    }

    dataDir
  }

  private def generateSecret(): String = {
    val bytes = new Array[Byte](48)
    new SecureRandom().nextBytes(bytes)
    Base64.getUrlEncoder.withoutPadding().encodeToString(bytes)
  }
}

object CerebroApp {
  def main(args: Array[String]): Unit = {
    SecretBootstrap.ensure()
    play.core.server.ProdServerStart.main(args)
  }
}
