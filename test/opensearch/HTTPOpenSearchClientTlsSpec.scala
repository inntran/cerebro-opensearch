package opensearch

import java.net.InetSocketAddress
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.security.KeyStore
import javax.net.ssl.{KeyManagerFactory, SSLContext}

import com.sun.net.httpserver.{HttpExchange, HttpsConfigurator, HttpsServer}
import models.{ClientTls, OpenSearchAuth, OpenSearchServer, Host}
import org.specs2.mutable.Specification
import play.api.libs.json.JsString

import scala.concurrent.Await
import scala.concurrent.duration._

class HTTPOpenSearchClientTlsSpec extends Specification {
  sequential

  private val password = "test-password"

  private def runKeytool(args: String*): Unit = {
    val process = new ProcessBuilder((Seq("keytool") ++ args): _*).redirectErrorStream(true).start()
    val output = new String(process.getInputStream.readAllBytes(), StandardCharsets.UTF_8)
    require(process.waitFor() == 0, s"keytool failed: $output")
  }

  private def withSelfSignedServer[A](validHostname: Boolean = false)(test: (String, String, () => (String, String, String)) => A): A = {
    val dir = Files.createTempDirectory("cerebro-untrusted-https")
    val keystore = dir.resolve("server.p12")
    val certificate = dir.resolve("server.pem")
    val keyArgs = Seq("-genkeypair", "-alias", "server", "-keyalg", "RSA", "-keysize", "2048",
      "-storetype", "PKCS12", "-keystore", keystore.toString, "-storepass", password,
      "-keypass", password, "-validity", "1", "-dname", "CN=wrong.example", "-noprompt") ++
      (if (validHostname) Seq("-ext", "SAN=IP:127.0.0.1") else Seq.empty)
    runKeytool(keyArgs: _*)
    runKeytool("-exportcert", "-rfc", "-alias", "server", "-keystore", keystore.toString,
      "-storepass", password, "-file", certificate.toString)

    val store = KeyStore.getInstance("PKCS12")
    val input = Files.newInputStream(keystore)
    try store.load(input, password.toCharArray)
    finally input.close()
    val kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm)
    kmf.init(store, password.toCharArray)
    val context = SSLContext.getInstance("TLS")
    context.init(kmf.getKeyManagers, null, null)

    var observed = ("", "", "")
    val server = HttpsServer.create(new InetSocketAddress("127.0.0.1", 0), 0)
    server.setHttpsConfigurator(new HttpsConfigurator(context))
    server.createContext("/echo", (exchange: HttpExchange) => {
      val body = new String(exchange.getRequestBody.readAllBytes(), StandardCharsets.UTF_8)
      observed = (exchange.getRequestMethod, body, exchange.getRequestHeaders.getFirst("Authorization"))
      val response = "{}".getBytes(StandardCharsets.UTF_8)
      exchange.sendResponseHeaders(200, response.length)
      val stream = exchange.getResponseBody
      try stream.write(response)
      finally stream.close()
    })
    server.start()
    try test(s"https://127.0.0.1:${server.getAddress.getPort}", Files.readString(certificate), () => observed)
    finally server.stop(0)
  }

  "untrusted HTTPS transport" should {
    "allow a self-signed, hostname-mismatched endpoint and preserve GET bodies and basic auth" in {
      withSelfSignedServer() { (url, _, observed) =>
        val target = OpenSearchServer(Host(url, Some(OpenSearchAuth("admin", "secret")), Seq.empty,
          Some(ClientTls(strictCaCheck = false))))
        val response = Await.result(new HTTPOpenSearchClient(null).executeRequest(
          "GET", "echo", Some(JsString("raw-body")), target), 10.seconds)
        (response.status, observed()) mustEqual
          ((200, ("GET", "raw-body", "Basic YWRtaW46c2VjcmV0")))
      }
    }

    "reject a self-signed endpoint when strict verification is enabled" in {
      withSelfSignedServer() { (url, _, _) =>
        val target = OpenSearchServer(Host(url, None, Seq.empty, Some(ClientTls(strictCaCheck = true))))
        Await.result(new HTTPOpenSearchClient(null).executeRequest("GET", "echo", None, target),
          10.seconds) must throwA[Exception]
      }
    }

    "still reject a wrong hostname when its CA is trusted in strict mode" in {
      withSelfSignedServer() { (url, cert, _) =>
        val target = OpenSearchServer(Host(url, None, Seq.empty,
          Some(ClientTls(caCertPem = Some(cert), strictCaCheck = true))))
        Await.result(new HTTPOpenSearchClient(null).executeRequest("GET", "echo", None, target),
          10.seconds) must throwA[Exception]
      }
    }

    "accept a matching hostname when its CA is supplied in strict mode" in {
      withSelfSignedServer(validHostname = true) { (url, cert, _) =>
        val target = OpenSearchServer(Host(url, None, Seq.empty,
          Some(ClientTls(caCertPem = Some(cert), strictCaCheck = true))))
        val response = Await.result(new HTTPOpenSearchClient(null).executeRequest("GET", "echo", None, target),
          10.seconds)
        response.status mustEqual 200
      }
    }
  }
}
