package controllers

import javax.inject.Inject

import controllers.auth.AuthenticationModule
import opensearch.OpenSearchClient
import models.{CerebroResponse, Hosts}

import scala.concurrent.ExecutionContext.Implicits.global

class IndexSettingsController @Inject()(val authentication: AuthenticationModule,
                                        val hosts: Hosts,
                                        client: OpenSearchClient,
                                    val appServices: AppServices) extends BaseController {

  def get = process { request =>
    client.getIndexSettingsFlat(request.get("index"), request.target).map { response =>
      CerebroResponse(response.status, response.body)
    }
  }

  def update = process { request =>
    val index = request.get("index")
    val settings = request.getObj("settings")
    client.updateIndexSettings(index, settings, request.target).map { response =>
      CerebroResponse(response.status, response.body)
    }
  }

}
