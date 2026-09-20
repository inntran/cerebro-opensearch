package models.templates

import org.specs2.mutable.Specification
import play.api.libs.json.Json

class TemplatesSpec extends Specification {

  "Templates" should {
    "normalize composable index_templates payloads" in {
      val input = Json.parse(
        """
          |{
          |  "index_templates": [
          |    {
          |      "name": "logs",
          |      "index_template": { "index_patterns": ["logs-*"], "priority": 100 }
          |    }
          |  ]
          |}
          |""".stripMargin)
      val out = Templates(input)
      (out \ 0 \ "name").as[String] mustEqual "logs"
      (out \ 0 \ "composable").as[Boolean] mustEqual true
      (out \ 0 \ "template" \ "priority").as[Int] mustEqual 100
    }

    "normalize legacy named template objects" in {
      val input = Json.parse(
        """
          |{
          |  "legacy": { "index_patterns": ["old-*"], "settings": { "number_of_shards": 1 } }
          |}
          |""".stripMargin)
      val out = Templates(input)
      (out \ 0 \ "name").as[String] mustEqual "legacy"
      (out \ 0 \ "composable").as[Boolean] mustEqual false
      (out \ 0 \ "template" \ "index_patterns" \ 0).as[String] mustEqual "old-*"
    }
  }
}
