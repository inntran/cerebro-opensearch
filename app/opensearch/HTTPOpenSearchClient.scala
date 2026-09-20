package opensearch

import java.net.{URI, URLEncoder}
import java.net.http.{HttpClient, HttpRequest, HttpResponse}
import java.nio.charset.StandardCharsets
import java.time.Duration
import java.util.Base64
import javax.inject.Singleton
import javax.net.ssl.SSLContext
import org.apache.hc.client5.http.impl.classic.HttpClients
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder
import org.apache.hc.client5.http.classic.methods.HttpUriRequestBase
import org.apache.hc.client5.http.ssl.{ClientTlsStrategyBuilder, HostnameVerificationPolicy, NoopHostnameVerifier}
import org.apache.hc.core5.http.io.entity.{EntityUtils, StringEntity}
import org.apache.hc.core5.http.ContentType

import com.google.inject.Inject
import opensearch.HTTPOpenSearchClient._
import models.OpenSearchServer
import models.security.TlsContextFactory
import play.api.libs.json._
import play.api.libs.ws.{WSAuthScheme, WSClient}

import scala.concurrent.ExecutionContext.Implicits.global
import scala.concurrent.Future
import scala.util.Try

@Singleton
class HTTPOpenSearchClient @Inject()(client: WSClient) extends OpenSearchClient {

  def main(target: OpenSearchServer) =
    execute(s"", "GET", None, target)

  def clusterState(target: OpenSearchServer) = {
    val path = "/_cluster/state/master_node,routing_table,routing_nodes,blocks"
    execute(path, "GET", None, target)
  }

  def indicesStats(target: OpenSearchServer) = {
    val path = "/_stats/docs,store"
    execute(path, "GET", None, target)
  }

  def nodesStats(stats: Seq[String], target: OpenSearchServer) = {
    val path = s"/_nodes/stats/${stats.mkString(",")}?human=true"
    execute(path, "GET", None, target)
  }

  def indexStats(index: String, target: OpenSearchServer): Future[OpenSearchResponse] = {
    val path = s"/${encoded(index)}/_stats?human=true"
    execute(path, "GET", None, target)
  }

  def nodeStats(node: String, target: OpenSearchServer) = {
    val path = s"/_nodes/${encoded(node)}/stats?human"
    execute(path, "GET", None, target)
  }

  def clusterSettings(target: OpenSearchServer) = {
    val path = "/_cluster/settings"
    execute(path, "GET", None, target)
  }

  def aliases(target: OpenSearchServer) = {
    val path = "/_aliases"
    execute(path, "GET", None, target)
  }

  def clusterHealth(target: OpenSearchServer) = {
    val path = "/_cluster/health"
    execute(path, "GET", None, target)
  }

  def nodes(flags: Seq[String], target: OpenSearchServer) = {
    val path = s"/_nodes/_all/${flags.mkString(",")}?human=true"
    execute(path, "GET", None, target)
  }

  def closeIndex(index: String, target: OpenSearchServer) = {
    val path = s"/${encoded(index)}/_close"
    execute(path, "POST", None, target, Seq(JsonContentType))
  }

  def openIndex(index: String, target: OpenSearchServer) = {
    val path = s"/${encoded(index)}/_open"
    execute(path, "POST", None, target, Seq(JsonContentType))
  }

  def refreshIndex(index: String, target: OpenSearchServer) = {
    val path = s"/${encoded(index)}/_refresh"
    execute(path, "POST", None, target, Seq(JsonContentType))
  }

  def flushIndex(index: String, target: OpenSearchServer) = {
    val path = s"/${encoded(index)}/_flush"
    execute(path, "POST", None, target, Seq(JsonContentType))
  }

  def forceMerge(index: String, target: OpenSearchServer) = {
    val path = s"/${encoded(index)}/_forcemerge"
    execute(path, "POST", None, target, Seq(JsonContentType))
  }

  def clearIndexCache(index: String, target: OpenSearchServer) = {
    val path = s"/${encoded(index)}/_cache/clear"
    execute(path, "POST", None, target, Seq(JsonContentType))
  }

  def deleteIndex(index: String, target: OpenSearchServer) = {
    val path = s"/${encoded(index)}"
    execute(path, "DELETE", None, target)
  }

  def getIndexSettings(index: String, target: OpenSearchServer) = {
    val path = s"/${encoded(index)}/_settings"
    execute(path, "GET", None, target)
  }

  def getIndexSettingsFlat(index: String, target: OpenSearchServer) = {
    val path = s"/${encoded(index)}/_settings?flat_settings=true&include_defaults=true"
    execute(path, "GET", None, target)
  }

  def getIndexMapping(index: String, target: OpenSearchServer) = {
    val path = s"/${encoded(index)}/_mapping"
    execute(path, "GET", None, target)
  }

  def putClusterSettings(settings: String, target: OpenSearchServer) = {
    val path = "/_cluster/settings"
    execute(path, "PUT", Some(settings), target, Seq(JsonContentType))
  }

  private def allocationSettings(value: String) =
    s"""{"transient": {"cluster": {"routing": {"allocation": {"enable": \"$value\"}}}}}"""

  def enableShardAllocation(target: OpenSearchServer) =
    putClusterSettings(allocationSettings("all"), target)

  def disableShardAllocation(target: OpenSearchServer, kind: String) =
    putClusterSettings(allocationSettings(kind), target)

  def getShardStats(index: String, target: OpenSearchServer) = {
    val path = s"/${encoded(index)}/_stats?level=shards&human=true"
    execute(path, "GET", None, target)
  }

  def relocateShard(shard: Int, index: String, from: String, to: String, target: OpenSearchServer) = {
    val path = "/_cluster/reroute"
    val commands =
      s"""
         |{
         |  "commands": [
         |    {
         |      "move": {
         |        "shard": $shard,
         |        "index": \"$index\",
         |        "from_node": \"$from\",
         |        "to_node": \"$to\"
         |      }
         |    }
         |  ]
         |}
       """.stripMargin
    execute(path, "POST", Some(commands), target, Seq(JsonContentType))
  }

  def getIndexRecovery(index: String, target: OpenSearchServer) = {
    val path = s"/${encoded(index)}/_recovery?active_only=true&human=true"
    execute(path, "GET", None, target)
  }

  def getClusterMapping(target: OpenSearchServer) = {
    val path = "/_mapping"
    execute(path, "GET", None, target)
  }

  def getAliases(target: OpenSearchServer) = {
    val path = "/_aliases"
    execute(path, "GET", None, target)
  }

  def updateAliases(changes: Seq[JsValue], target: OpenSearchServer) = {
    val path = "/_aliases"
    val body = Json.obj("actions" -> JsArray(changes))
    execute(path, "POST", Some(body.toString), target, Seq(JsonContentType))
  }

  def getIndexMetadata(index: String, target: OpenSearchServer) = {
    val path = s"/_cluster/state/metadata/${encoded(index)}?human=true"
    execute(path, "GET", None, target)
  }

  def createIndex(index: String, metadata: JsValue, target: OpenSearchServer) = {
    val path = s"/${encoded(index)}"
    execute(path, "PUT", Some(metadata.toString), target, Seq(JsonContentType))
  }

  def getIndices(target: OpenSearchServer) = {
    val path = s"/_cat/indices?format=json"
    execute(path, "GET", None, target)
  }

  def getTemplates(target: OpenSearchServer) = {
    // Prefer composable index templates (OpenSearch / ES 7.8+); fall back to legacy _template.
    execute("/_index_template", "GET", None, target).flatMap {
      case s @ Success(_, _) => Future.successful(s)
      case Error(status, _) if status == 404 || status == 400 || status == 405 =>
        execute("/_template", "GET", None, target)
      case other => Future.successful(other)
    }
  }

  def createTemplate(name: String, template: JsValue, target: OpenSearchServer) = {
    val path = s"/_index_template/${encoded(name)}"
    execute(path, "PUT", Some(template.toString), target, Seq(JsonContentType)).flatMap {
      case s @ Success(_, _) => Future.successful(s)
      case Error(status, _) if status == 404 || status == 400 || status == 405 =>
        execute(s"/_template/${encoded(name)}", "PUT", Some(template.toString), target, Seq(JsonContentType))
      case other => Future.successful(other)
    }
  }

  def deleteTemplate(name: String, target: OpenSearchServer) = {
    val path = s"/_index_template/${encoded(name)}"
    execute(path, "DELETE", None, target).flatMap {
      case s @ Success(_, _) => Future.successful(s)
      case Error(status, _) if status == 404 || status == 400 || status == 405 =>
        execute(s"/_template/${encoded(name)}", "DELETE", None, target)
      case other => Future.successful(other)
    }
  }

  def getNodes(target: OpenSearchServer) = {
    val path = s"/_cat/nodes?format=json"
    execute(path, "GET", None, target)
  }

  def analyzeTextByField(index: String, field: String, text: String, target: OpenSearchServer) = {
    val path = s"/${encoded(index)}/_analyze"
    val body = Json.obj("text" -> text, "field" -> field).toString()
    execute(path, "GET", Some(body), target, Seq(JsonContentType))
  }

  def analyzeTextByAnalyzer(index: String, analyzer: String, text: String, target: OpenSearchServer) = {
    val path = s"/${encoded(index)}/_analyze"
    val body = Json.obj("text" -> text, "analyzer" -> analyzer).toString()
    execute(path, "GET", Some(body), target, Seq(JsonContentType))
  }

  def getClusterSettings(target: OpenSearchServer) = {
    val path = s"/_cluster/settings?flat_settings=true&include_defaults=true"
    execute(path, "GET", None, target)
  }


  // Repositories
  def getRepositories(target: OpenSearchServer) = {
    val path = s"/_snapshot"
    execute(path, "GET", None, target)
  }

  def createRepository(name: String, repoType: String, settings: JsValue, target: OpenSearchServer) = {
    val path = s"/_snapshot/${encoded(name)}"
    val data = Json.obj("type" -> JsString(repoType), "settings" -> settings).toString
    execute(path, "PUT", Some(data), target, Seq(JsonContentType))
  }

  def deleteRepository(name: String, target: OpenSearchServer) = {
    val path = s"/_snapshot/${encoded(name)}"
    execute(path, "DELETE", None, target)
  }

  // Snapshots
  def getSnapshots(repository: String, target: OpenSearchServer) = {
    val path = s"/_snapshot/${encoded(repository)}/_all"
    execute(path, "GET", None, target)
  }

  def deleteSnapshot(repository: String, snapshot: String, target: OpenSearchServer) = {
    val path = s"/_snapshot/${encoded(repository)}/${encoded(snapshot)}"
    execute(path, "DELETE", None, target)
  }

  def createSnapshot(repository: String, snapshot: String, ignoreUnavailable: Boolean,
                     includeGlobalState: Boolean, indices: Option[String], target: OpenSearchServer) = {
    val path = s"/_snapshot/${encoded(repository)}/${encoded(snapshot)}"
    val data = JsObject(
      Seq(
        ("ignore_unavailable", JsBoolean(ignoreUnavailable)),
        ("include_global_state", JsBoolean(includeGlobalState))
      ) ++ indices.map { i => Seq(("indices", JsString(i))) }.getOrElse(Nil)
    ).toString
    execute(path, "PUT", Some(data), target, Seq(JsonContentType))
  }

  def restoreSnapshot(repository: String, snapshot: String, renamePattern: Option[String],
                      renameReplacement: Option[String], ignoreUnavailable: Boolean, includeAliases: Boolean,
                      includeGlobalState: Boolean, indices: Option[String], target: OpenSearchServer) = {
    val path = s"/_snapshot/${encoded(repository)}/${encoded(snapshot)}/_restore"
    val data = JsObject(
      Seq(
        ("ignore_unavailable", JsBoolean(ignoreUnavailable)),
        ("include_global_state", JsBoolean(includeGlobalState)),
        ("include_aliases", JsBoolean(includeAliases))
      ) ++
        indices.map { i => Seq(("indices", JsString(i))) }.getOrElse(Nil) ++
        renamePattern.map { r => Seq(("rename_pattern", JsString(r))) }.getOrElse(Nil) ++
        renameReplacement.map { r => Seq(("rename_replacement", JsString(r))) }.getOrElse(Nil)
    ).toString
    execute(path, "POST", Some(data), target, Seq(JsonContentType))
  }

  def saveClusterSettings(settings: JsValue, target: OpenSearchServer) = {
    val path = s"/_cluster/settings"
    execute(path, "PUT", Some(settings.toString), target, Seq(JsonContentType))
  }

  def updateIndexSettings(index: String, settings: JsValue, target: OpenSearchServer) = {
    val path = s"/${encoded(index)}/_settings"
    execute(path, "PUT", Some(settings.toString), target, Seq(JsonContentType))
  }

  // Cat requests
  def catRequest(api: String, target: OpenSearchServer) = {
    val path = s"/_cat/$api"
    execute(s"$path?format=json", "GET", None, target)
  }

  def executeRequest(method: String, path: String, data: Option[JsValue], target: OpenSearchServer) = {
    val headers = data.map {
      case _: JsString => NdJsonContentType // if it's not a json, it is assumed that bulk or multi-search API is used
      case _ => JsonContentType
    }.toSeq
    
    val body = data.map {
      case JsString(value) => value // needed to handle non valid json requests(multisearch, bulk...)
      case v: JsValue => v.toString
    }
    execute(s"/${path}", method, body, target, headers)
  }

  protected def execute[T](uri: String,
                           method: String,
                           body: Option[String] = None,
                           target: OpenSearchServer,
                           headers: Seq[(String, String)] = Seq()): Future[OpenSearchResponse] = {
    val url = s"${target.host.name.replaceAll("/+$", "")}$uri"
    val mergedHeaders = headers ++ target.headers

    target.host.tls match {
      case Some(tls) =>
        Future {
          val ssl = TlsContextFactory.sslContext(tls)
          if (!tls.strictCaCheck && URI.create(url).getScheme.equalsIgnoreCase("https"))
            executeUntrustedHttps(url, method, body, target, mergedHeaders, ssl)
          else
            executeJavaHttp(url, method, body, target, mergedHeaders, Some(ssl))
        }
      case None =>
        val request =
          target.host.authentication.foldLeft(client.url(url).withMethod(method).withHttpHeaders(mergedHeaders: _*)) {
            case (req, auth) => req.withAuth(auth.username, auth.password, WSAuthScheme.BASIC)
          }.withFollowRedirects(false)

        body.fold(request)(request.withBody((_))).execute().map(OpenSearchResponse(_))
    }
  }

  private def executeJavaHttp(
    url: String,
    method: String,
    body: Option[String],
    target: OpenSearchServer,
    headers: Seq[(String, String)],
    ssl: Option[SSLContext]
  ): OpenSearchResponse = {
    val builder = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).connectTimeout(Duration.ofSeconds(30))
    ssl.foreach(builder.sslContext)
    val httpClient = builder.build()

    var req = HttpRequest.newBuilder(java.net.URI.create(url)).timeout(Duration.ofSeconds(120))
    headers.foreach { case (k, v) => req = req.header(k, v) }
    target.host.authentication.foreach { auth =>
      val token = Base64.getEncoder.encodeToString(s"${auth.username}:${auth.password}".getBytes(StandardCharsets.UTF_8))
      req = req.header("Authorization", s"Basic $token")
    }

    val publisher = body match {
      case Some(b) => HttpRequest.BodyPublishers.ofString(b)
      case None if method.equalsIgnoreCase("GET") || method.equalsIgnoreCase("DELETE") || method.equalsIgnoreCase("HEAD") =>
        HttpRequest.BodyPublishers.noBody()
      case None => HttpRequest.BodyPublishers.noBody()
    }
    req = req.method(method.toUpperCase, publisher)

    val response = httpClient.send(req.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8))
    OpenSearchResponse(response.statusCode(), response.body())
  }

  private def executeUntrustedHttps(
    url: String,
    method: String,
    body: Option[String],
    target: OpenSearchServer,
    headers: Seq[(String, String)],
    ssl: SSLContext
  ): OpenSearchResponse = {
    val tlsStrategy = ClientTlsStrategyBuilder.create()
      .setSslContext(ssl)
      .setHostVerificationPolicy(HostnameVerificationPolicy.CLIENT)
      .setHostnameVerifier(NoopHostnameVerifier.INSTANCE)
      .buildClassic()
    val manager = PoolingHttpClientConnectionManagerBuilder.create()
      .setTlsSocketStrategy(tlsStrategy)
      .build()
    val request = new HttpUriRequestBase(method.toUpperCase, URI.create(url))
    headers.foreach { case (key, value) => request.addHeader(key, value) }
    target.host.authentication.foreach { auth =>
      val token = Base64.getEncoder.encodeToString(s"${auth.username}:${auth.password}".getBytes(StandardCharsets.UTF_8))
      request.addHeader("Authorization", s"Basic $token")
    }
    body.foreach { value =>
      val contentType = headers.find(_._1.equalsIgnoreCase("Content-Type"))
        .map(h => ContentType.parse(h._2)).getOrElse(ContentType.APPLICATION_JSON)
      request.setEntity(new StringEntity(value, contentType))
    }
    val httpClient = HttpClients.custom().setConnectionManager(manager).disableRedirectHandling().build()
    try httpClient.execute(request, response =>
      OpenSearchResponse(response.getCode,
        if (response.getEntity == null) "" else EntityUtils.toString(response.getEntity, StandardCharsets.UTF_8))
    )
    finally httpClient.close()
  }

  // FIXME: ES > 5.X does not support indices with special characters, so this could be removed
  private def encoded(text: String): String = URLEncoder.encode(text, "UTF-8")

  override def catMaster(target: OpenSearchServer): Future[OpenSearchResponse] = {
    val path = "/_cat/master"
    execute(s"$path?format=json", "GET", None, target)
  }
}

object HTTPOpenSearchClient {
  val JsonContentType: (String, String) = ("Content-type", "application/json")

  val NdJsonContentType: (String, String) = ("Content-type", "application/x-ndjson")
}
