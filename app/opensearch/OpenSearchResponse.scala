package opensearch

import play.api.libs.json.{JsString, JsValue, Json}
import play.api.libs.ws.WSResponse

import scala.util.Try

sealed trait OpenSearchResponse {
  val status: Int
  val body: JsValue
}

case class Success(status: Int, body: JsValue) extends OpenSearchResponse

case class Error(status: Int, body: JsValue) extends OpenSearchResponse

object OpenSearchResponse {

  def isSuccess(status: Int): Boolean = status >= 200 && status < 300

  def apply(status: Int, bodyText: String, contentType: Option[String] = None): OpenSearchResponse = {
    val parsed = Try(Json.parse(bodyText)).getOrElse {
      if (bodyText == null || bodyText.isEmpty) Json.obj()
      else Json.obj("body" -> JsString(bodyText))
    }
    if (isSuccess(status)) Success(status, parsed) else Error(status, parsed)
  }

  def apply(response: WSResponse): OpenSearchResponse =
    apply(response.status, response.body, Option(response.contentType).filter(_.nonEmpty))
}
