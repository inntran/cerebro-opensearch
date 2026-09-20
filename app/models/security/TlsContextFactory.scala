package models.security

import java.io.ByteArrayInputStream
import java.security.cert.{CertificateFactory, X509Certificate}
import java.security.{KeyFactory, KeyStore, PrivateKey, SecureRandom}
import java.security.spec.PKCS8EncodedKeySpec
import java.util.Base64
import javax.net.ssl.{KeyManager, KeyManagerFactory, SSLContext, TrustManager, TrustManagerFactory, X509TrustManager}

import models.ClientTls

object TlsContextFactory {

  def sslContext(tls: ClientTls): SSLContext = {
    val keyManagers: Array[KeyManager] =
      if (tls.hasClientIdentity) {
        val certs = loadCertificates(tls.clientCertPem.get)
        val key = loadPrivateKey(tls.clientKeyPem.get)
        val keyStore = KeyStore.getInstance("PKCS12")
        keyStore.load(null, null)
        keyStore.setKeyEntry("client", key, Array.emptyCharArray, certs.toArray)
        val kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm)
        kmf.init(keyStore, Array.emptyCharArray)
        kmf.getKeyManagers
      } else {
        null
      }

    val trustManagers: Array[TrustManager] = if (!tls.strictCaCheck) {
      Array[TrustManager](new X509TrustManager {
        override def getAcceptedIssuers: Array[X509Certificate] = Array.empty[X509Certificate]
        override def checkClientTrusted(chain: Array[X509Certificate], authType: String): Unit = ()
        override def checkServerTrusted(chain: Array[X509Certificate], authType: String): Unit = ()
      })
    } else {
      val tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm)
      if (tls.hasCustomTrust) {
      val trustStore = KeyStore.getInstance(KeyStore.getDefaultType)
      trustStore.load(null, null)
      loadCertificates(tls.caCertPem.get).zipWithIndex.foreach { case (c, i) =>
        trustStore.setCertificateEntry(s"ca-$i", c)
      }
      tmf.init(trustStore)
      } else {
        tmf.init(null.asInstanceOf[KeyStore])
      }
      tmf.getTrustManagers
    }

    val ctx = SSLContext.getInstance("TLS")
    ctx.init(keyManagers, trustManagers, new SecureRandom())
    ctx
  }

  private def loadCertificates(pem: String): Seq[X509Certificate] = {
    val factory = CertificateFactory.getInstance("X.509")
    val derBlocks = extractPemBlocks(pem, "CERTIFICATE")
    if (derBlocks.isEmpty) {
      throw new IllegalArgumentException("No certificates found in PEM")
    }
    derBlocks.map { der =>
      factory.generateCertificate(new ByteArrayInputStream(der)).asInstanceOf[X509Certificate]
    }
  }

  private def loadPrivateKey(pem: String): PrivateKey = {
    val pkcs8 = extractPemBlocks(pem, "PRIVATE KEY").headOption
      .orElse(extractPemBlocks(pem, "RSA PRIVATE KEY").headOption.map(convertPkcs1ToPkcs8))
      .getOrElse(throw new IllegalArgumentException("No private key found in PEM"))
    val spec = new PKCS8EncodedKeySpec(pkcs8)
    try KeyFactory.getInstance("RSA").generatePrivate(spec)
    catch {
      case _: Exception =>
        try KeyFactory.getInstance("EC").generatePrivate(spec)
        catch {
          case _: Exception => KeyFactory.getInstance("Ed25519").generatePrivate(spec)
        }
    }
  }

  private def extractPemBlocks(pem: String, label: String): Seq[Array[Byte]] = {
    val begin = s"-----BEGIN $label-----"
    val end = s"-----END $label-----"
    val chunks = pem.split(begin).drop(1)
    chunks.toSeq.flatMap { chunk =>
      val body = chunk.split(end).headOption.getOrElse("")
      val b64 = body.replaceAll("\\s", "")
      if (b64.isEmpty) None else Some(Base64.getDecoder.decode(b64))
    }
  }

  /** Minimal PKCS#1 RSA → PKCS#8 wrap (enough for typical OpenSearch admin keys). */
  private def convertPkcs1ToPkcs8(pkcs1: Array[Byte]): Array[Byte] = {
    val rsaOid = Array[Byte](0x2a.toByte, 0x86.toByte, 0x48, 0x86.toByte, 0xf7.toByte, 0x0d, 0x01, 0x01, 0x01)
    val algId = encodeSequence(encodeOid(rsaOid) ++ encodeNull())
    encodeSequence(encodeInteger(0) ++ algId ++ encodeOctetString(pkcs1))
  }

  private def encodeSequence(content: Array[Byte]): Array[Byte] =
    Array[Byte](0x30.toByte) ++ encodeLength(content.length) ++ content

  private def encodeInteger(value: Int): Array[Byte] =
    Array[Byte](0x02, 0x01, value.toByte)

  private def encodeNull(): Array[Byte] = Array[Byte](0x05, 0x00)

  private def encodeOid(oid: Array[Byte]): Array[Byte] =
    Array[Byte](0x06.toByte, oid.length.toByte) ++ oid

  private def encodeOctetString(content: Array[Byte]): Array[Byte] =
    Array[Byte](0x04.toByte) ++ encodeLength(content.length) ++ content

  private def encodeLength(len: Int): Array[Byte] = {
    if (len < 128) Array(len.toByte)
    else if (len < 256) Array(0x81.toByte, len.toByte)
    else Array(0x82.toByte, (len >> 8).toByte, (len & 0xff).toByte)
  }
}
