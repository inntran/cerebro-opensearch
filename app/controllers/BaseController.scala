package controllers

import controllers.auth.{AuthRequest, AuthenticationModule}
import exceptions.MissingRequiredParamException
import models.{CerebroRequest, CerebroResponse, Hosts}
import play.api.Logger
import play.api.libs.json._
import play.api.mvc.{InjectedController, Result}
import services.exception.RequestFailedException

import scala.concurrent.ExecutionContext.Implicits.global
import scala.concurrent.Future
import scala.util.control.NonFatal

trait BaseController extends InjectedController with AuthSupport {

  val authentication: AuthenticationModule

  val hosts: Hosts

  val appServices: AppServices

  private val logger = Logger("application")

  type RequestProcessor = (CerebroRequest) => Future[Result]

  final def process(processor: RequestProcessor) = AuthAction(authentication).async(parse.json) { request =>
    try {
      val cerebroRequest = CerebroRequest(request, hosts, Some(appServices.hostValidator))
      processor(cerebroRequest).map { result =>
        maybeAuditMutation(request, cerebroRequest, result)
        result
      }.recoverWith {
        case requestFailed: RequestFailedException =>
          Future.successful(CerebroResponse(requestFailed.status, Json.obj("error" -> requestFailed.getMessage)))
        case NonFatal(e) =>
          logger.error(s"Error processing request [${request.path}]", e)
          Future.successful(CerebroResponse(500, Json.obj("error" -> e.getMessage)))
      }
    } catch {
      case e: MissingRequiredParamException =>
        Future.successful(CerebroResponse(400, Json.obj("error" -> e.getMessage)))
      case e: IllegalArgumentException =>
        Future.successful(CerebroResponse(400, Json.obj("error" -> e.getMessage)))
      case NonFatal(e) =>
        logger.error(s"Error processing request [${request.path}]", e)
        Future.successful(CerebroResponse(500, Json.obj("error" -> e.getMessage)))
    }
  }

  private def maybeAuditMutation(request: AuthRequest[JsValue], cerebro: CerebroRequest, result: Result): Unit = {
    if (!appServices.audit.enabled) return
    val path = request.path
    val isRestMutation = path == "/rest/request" &&
      (request.body \ "method").asOpt[String].exists(m => !Set("GET", "HEAD").contains(m.toUpperCase))
    if (!isRestMutation && !MutationPathHints.exists(path.contains)) return
    val user = cerebro.target.host.authentication.map(_.username).getOrElse(
      request.user.map(_.name).getOrElse("anonymous")
    )
    appServices.audit.record("mutation", Map(
      "path" -> path,
      "host" -> cerebro.target.host.name,
      "user" -> user,
      "status" -> result.header.status.toString
    ))
  }

  private val MutationPathHints = Seq(
    "delete", "create", "update", "save", "close", "open", "flush", "refresh",
    "force_merge", "clear", "relocate", "disable", "enable", "restore", "aliases/update"
  )

}
