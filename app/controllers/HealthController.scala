package controllers

import javax.inject.Inject

import play.api.mvc.InjectedController
import play.api.libs.json.Json
import models.BuildInfo

class HealthController @Inject() extends InjectedController {
  def health = Action {
    Ok(Json.obj(
      "status" -> "ok",
      "version" -> BuildInfo.version,
      "name" -> BuildInfo.name
    ))
  }
}
