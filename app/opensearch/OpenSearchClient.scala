package opensearch

import com.google.inject.ImplementedBy
import models.OpenSearchServer
import play.api.libs.json._

import scala.concurrent.Future

@ImplementedBy(classOf[HTTPOpenSearchClient])
trait OpenSearchClient {

  def main(target: OpenSearchServer): Future[OpenSearchResponse]

  def clusterState(target: OpenSearchServer): Future[OpenSearchResponse]

  def indicesStats(target: OpenSearchServer): Future[OpenSearchResponse]

  def nodesStats(stats: Seq[String], target: OpenSearchServer): Future[OpenSearchResponse]

  def nodeStats(node: String, target: OpenSearchServer): Future[OpenSearchResponse]

  def indexStats(index: String, target: OpenSearchServer): Future[OpenSearchResponse]

  def clusterSettings(target: OpenSearchServer): Future[OpenSearchResponse]

  def aliases(target: OpenSearchServer): Future[OpenSearchResponse]

  def clusterHealth(target: OpenSearchServer): Future[OpenSearchResponse]

  def nodes(flags: Seq[String], target: OpenSearchServer): Future[OpenSearchResponse]

  def closeIndex(index: String, target: OpenSearchServer): Future[OpenSearchResponse]

  def openIndex(index: String, target: OpenSearchServer): Future[OpenSearchResponse]

  def refreshIndex(index: String, target: OpenSearchServer): Future[OpenSearchResponse]

  def flushIndex(index: String, target: OpenSearchServer): Future[OpenSearchResponse]

  def forceMerge(index: String, target: OpenSearchServer): Future[OpenSearchResponse]

  def clearIndexCache(index: String, target: OpenSearchServer): Future[OpenSearchResponse]

  def deleteIndex(index: String, target: OpenSearchServer): Future[OpenSearchResponse]

  def getIndexSettings(index: String, target: OpenSearchServer): Future[OpenSearchResponse]

  def getIndexSettingsFlat(index: String, target: OpenSearchServer): Future[OpenSearchResponse]

  def getIndexMapping(index: String, target: OpenSearchServer): Future[OpenSearchResponse]

  def putClusterSettings(settings: String, target: OpenSearchServer): Future[OpenSearchResponse]

  private def allocationSettings(value: String) =
    s"""{"transient": {"cluster": {"routing": {"allocation": {"enable": \"$value\"}}}}}"""

  def enableShardAllocation(target: OpenSearchServer): Future[OpenSearchResponse]

  def disableShardAllocation(target: OpenSearchServer, kind: String): Future[OpenSearchResponse]

  def getShardStats(index: String, target: OpenSearchServer): Future[OpenSearchResponse]

  def relocateShard(shard: Int, index: String, from: String, to: String, target: OpenSearchServer): Future[OpenSearchResponse]

  def getIndexRecovery(index: String, target: OpenSearchServer): Future[OpenSearchResponse]

  def getClusterMapping(target: OpenSearchServer): Future[OpenSearchResponse]

  def getAliases(target: OpenSearchServer): Future[OpenSearchResponse]

  def updateAliases(changes: Seq[JsValue], target: OpenSearchServer): Future[OpenSearchResponse]

  def getIndexMetadata(index: String, target: OpenSearchServer): Future[OpenSearchResponse]

  def createIndex(index: String, metadata: JsValue, target: OpenSearchServer): Future[OpenSearchResponse]

  def getIndices(target: OpenSearchServer): Future[OpenSearchResponse]

  def getTemplates(target: OpenSearchServer): Future[OpenSearchResponse]

  def createTemplate(name: String, template: JsValue, target: OpenSearchServer): Future[OpenSearchResponse]

  def deleteTemplate(name: String, target: OpenSearchServer): Future[OpenSearchResponse]

  def getNodes(target: OpenSearchServer): Future[OpenSearchResponse]

  def analyzeTextByField(index: String, field: String, text: String, target: OpenSearchServer): Future[OpenSearchResponse]

  def analyzeTextByAnalyzer(index: String, analyzer: String, text: String, target: OpenSearchServer): Future[OpenSearchResponse]

  def getClusterSettings(target: OpenSearchServer): Future[OpenSearchResponse]

  // Repositories
  def getRepositories(target: OpenSearchServer): Future[OpenSearchResponse]

  def createRepository(name: String, repoType: String, settings: JsValue, target: OpenSearchServer): Future[OpenSearchResponse]

  def deleteRepository(name: String, target: OpenSearchServer): Future[OpenSearchResponse]

  // Snapshots
  def getSnapshots(repository: String, target: OpenSearchServer): Future[OpenSearchResponse]

  def deleteSnapshot(repository: String, snapshot: String, target: OpenSearchServer): Future[OpenSearchResponse]

  def createSnapshot(repository: String, snapshot: String, ignoreUnavailable: Boolean,
                     includeGlobalState: Boolean, indices: Option[String], target: OpenSearchServer): Future[OpenSearchResponse]

  def restoreSnapshot(repository: String, snapshot: String, renamePattern: Option[String],
                      renameReplacement: Option[String], ignoreUnavailable: Boolean, includeAliases: Boolean,
                      includeGlobalState: Boolean, indices: Option[String], target: OpenSearchServer): Future[OpenSearchResponse]

  def saveClusterSettings(settings: JsValue, target: OpenSearchServer): Future[OpenSearchResponse]

  def updateIndexSettings(index: String, settings: JsValue, target: OpenSearchServer): Future[OpenSearchResponse]

  // Cat requests
  def catRequest(api: String, target: OpenSearchServer): Future[OpenSearchResponse]

  // Cat master
  def catMaster(target: OpenSearchServer): Future[OpenSearchResponse]

  def executeRequest(method: String, path: String, data: Option[JsValue], target: OpenSearchServer): Future[OpenSearchResponse]

}
