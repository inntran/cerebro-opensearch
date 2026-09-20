package models.templates

import play.api.libs.json._

object Templates {

  def apply(json: JsValue): JsValue = json match {
    case obj: JsObject if (obj \ "index_templates").asOpt[JsArray].isDefined =>
      val items = (obj \ "index_templates").as[JsArray].value.map { item =>
        val name = (item \ "name").asOpt[String].getOrElse("")
        val template = (item \ "index_template").asOpt[JsValue].getOrElse(item)
        Json.obj("name" -> name, "template" -> template, "composable" -> true)
      }
      JsArray(items)
    case obj: JsObject =>
      JsArray(obj.keys.toSeq.sorted.map { name =>
        Json.obj("name" -> name, "template" -> (obj \ name).as[JsValue], "composable" -> false)
      })
    case other => other
  }

}
