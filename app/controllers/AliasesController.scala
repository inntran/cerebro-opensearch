package controllers

import javax.inject.Inject

import controllers.auth.AuthenticationModule
import opensearch.{OpenSearchClient, Error, Success}
import models.{Aliases, CerebroResponse, Hosts}
import play.api.libs.json.JsArray

import scala.concurrent.ExecutionContext.Implicits.global

class AliasesController @Inject()(val authentication: AuthenticationModule,
                                  val hosts: Hosts,
                                  client: OpenSearchClient,
                                    val appServices: AppServices) extends BaseController {

  def getAliases = process { request =>
    client.getAliases(request.target).map {
      case Success(status, aliases) => CerebroResponse(status, Aliases(aliases))
      case Error(status, error) => CerebroResponse(status, error)
    }
  }

  def updateAliases = process { request =>
    val changes = request.getOptArray("changes").getOrElse(JsArray()).value.toSeq
    client.updateAliases(changes, request.target).map { aliases =>
      CerebroResponse(aliases.status, aliases.body)
    }
  }

}
