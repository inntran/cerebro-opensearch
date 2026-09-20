package models.security

import java.nio.file.Files

import org.specs2.mutable.Specification

class TlsContextFactorySpec extends Specification {

  /** Ephemeral self-signed material for unit tests (never checked into the repo). */
  private def generateSelfSignedPem(): (String, String) = {
    val dir = Files.createTempDirectory("cerebro-tls-test")
    val key = dir.resolve("key.pem")
    val cert = dir.resolve("cert.pem")
    val pb = new ProcessBuilder(
      "openssl", "req", "-x509", "-newkey", "rsa:2048",
      "-keyout", key.toString,
      "-out", cert.toString,
      "-days", "1",
      "-nodes",
      "-subj", "/CN=cerebro-test"
    )
    pb.redirectErrorStream(true)
    val proc = pb.start()
    val out = new String(proc.getInputStream.readAllBytes())
    require(proc.waitFor() == 0, s"openssl failed: $out")
    (Files.readString(cert), Files.readString(key))
  }

  "TlsContextFactory" should {
    "build an SSLContext from client cert + PKCS#8 key" in {
      val (certPem, keyPem) = generateSelfSignedPem()
      val ctx = TlsContextFactory.sslContext(models.ClientTls(
        clientCertPem = Some(certPem),
        clientKeyPem = Some(keyPem)
      ))
      ctx.getProtocol mustEqual "TLS"
    }

    "accept an optional CA PEM with mTLS" in {
      val (certPem, keyPem) = generateSelfSignedPem()
      val ctx = TlsContextFactory.sslContext(models.ClientTls(
        clientCertPem = Some(certPem),
        clientKeyPem = Some(keyPem),
        caCertPem = Some(certPem)
      ))
      ctx.getProtocol mustEqual "TLS"
    }

    "build an SSLContext from CA-only PEM for custom server trust" in {
      val (certPem, _) = generateSelfSignedPem()
      val ctx = TlsContextFactory.sslContext(models.ClientTls(caCertPem = Some(certPem)))
      ctx.getProtocol mustEqual "TLS"
    }

    "reject mTLS PEM without a private key" in {
      val (certPem, _) = generateSelfSignedPem()
      TlsContextFactory.sslContext(models.ClientTls(
        clientCertPem = Some(certPem),
        clientKeyPem = Some("not-a-key")
      )) must throwA[IllegalArgumentException]
    }
  }
}
