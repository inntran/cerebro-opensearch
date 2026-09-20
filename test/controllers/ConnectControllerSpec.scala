package controllers

import org.specs2.mutable.Specification
import play.api.inject.guice.GuiceApplicationBuilder
import play.api.libs.json.Json
import play.api.test.FakeRequest
import play.api.test.Helpers._

class ConnectControllerSpec extends Specification {
  "GET /connect/hosts" should {
    "keep the AngularJS array contract for named bookmarks" in {
      val app = new GuiceApplicationBuilder().configure(
        "hosts" -> Seq(Map("name" -> "production", "host" -> "https://search.example:9200"))
      ).build()
      try {
        val response = route(app, FakeRequest(GET, "/connect/hosts")).get
        status(response) mustEqual OK
        (contentAsJson(response) \ "body").as[Seq[String]] mustEqual Seq("production")
      } finally {
        app.stop()
      }
    }
  }
}
