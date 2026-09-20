package services.cluster_changes

import com.google.inject.Inject
import opensearch.{OpenSearchClient, Error}
import models.OpenSearchServer
import play.api.libs.json._
import services.exception.RequestFailedException

import scala.concurrent.ExecutionContext.Implicits.global
import scala.concurrent.Future

class ClusterChangesDataService @Inject()(client: OpenSearchClient) {

  val apis = Seq(
    "_aliases",
    "_nodes/transport",
    "_cluster/state/blocks"
  )

  def data(target: OpenSearchServer): Future[JsValue] = {
    Future.sequence(apis.map(client.executeRequest("GET", _, None, target))).map { responses =>
      responses.zipWithIndex.find(_._1.isInstanceOf[Error]) match {
        case Some((response, idx)) =>
          throw RequestFailedException(apis(idx), response.status, response.body.toString())
        case None =>
          val aliases = responses(0).body
          val nodesInfo = responses(1).body
          val state = responses(2).body

          // open indices
          val indices = aliases.as[JsObject].keys.map(JsString(_)).toSeq

          val blocks = (state \ "blocks" \ "indices").asOpt[JsObject].getOrElse(Json.obj())
          val closedIndices = blocks.keys.collect {
            case index if (blocks \ index \ "4").asOpt[JsObject].isDefined => JsString(index)
          }

          val nodes = (nodesInfo \\ "name").collect {
            case node: JsString => node
          }.distinct

          val clusterName = (state \ "cluster_name").as[JsValue]
          Json.obj(
            "indices" -> JsArray(indices ++ closedIndices),
            "nodes" -> JsArray(nodes),
            "cluster_name" -> clusterName
          )
      }

    }
  }

}
