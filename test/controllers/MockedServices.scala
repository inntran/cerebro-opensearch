package controllers

import controllers.auth.AuthenticationModule
import opensearch.OpenSearchClient
import models.security.{HostValid, HostValidation, HostValidator}
import org.specs2.Specification
import org.specs2.mock.Mockito
import org.specs2.specification.BeforeEach
import play.api.inject.bind
import play.api.inject.guice.GuiceApplicationBuilder
import play.api.Configuration
import play.api.libs.json.JsValue
import play.api.mvc.Result
import play.api.test.Helpers.{contentAsJson, _}

import scala.concurrent.Future
import services.audit.AuditService

trait MockedServices extends Specification with BeforeEach with Mockito {

  val client = mock[OpenSearchClient]

  val auth = mock[AuthenticationModule]
  auth.isEnabled returns false

  // Historical controller fixtures use "somehost" as a symbolic target. Keep URL
  // validation active in production while allowing that target in controller tests.
  val testServices = new AppServices {
    override val configuration: Configuration = Configuration.empty
    override val audit: AuditService = mock[AuditService]
    override val hostValidator: HostValidator = new HostValidator(configuration) {
      override def validate(raw: String): HostValidation =
        if (raw == "somehost") HostValid else super.validate(raw)
    }
  }

  override def before = {
    org.mockito.Mockito.reset(client)
  }

  val application = new GuiceApplicationBuilder().
    overrides(
      bind[OpenSearchClient].toInstance(client),
      bind[AuthenticationModule].toInstance(auth),
      bind[AppServices].toInstance(testServices)
    ).build()

  def ensure(response: Future[Result], statusCode: Int, body: JsValue) = {
    ((contentAsJson(response) \ "body").as[JsValue] mustEqual body) and
      ((contentAsJson(response) \ "status").as[Int] mustEqual statusCode)
  }

}
