package models

import com.typesafe.config.ConfigFactory
import org.specs2.mutable.Specification
import play.api.Configuration

class HostsSpec extends Specification {

  "HostsImpl" should {
    "load bookmark addresses without requiring credentials" in {
      val conf = Configuration(ConfigFactory.parseString(
        """
          |hosts = [
          |  { host = "https://os.example:9200", name = "prod" },
          |  { host = "http://localhost:9200" }
          |]
          |""".stripMargin))
      val hosts = new HostsImpl(conf)
      hosts.getBookmarks().map(_.name).toSet mustEqual Set("prod", "http://localhost:9200")
      hosts.getHost("prod").map(_.name) must beSome("https://os.example:9200")
      hosts.getHost("https://os.example:9200").map(_.name) must beSome("https://os.example:9200")
      hosts.getHost("prod").flatMap(_.authentication) must beNone
    }

    "resolve optional legacy config auth when present" in {
      val conf = Configuration(ConfigFactory.parseString(
        """
          |hosts = [
          |  {
          |    host = "https://secured.example:9200"
          |    name = "secured"
          |    auth = { username = "admin", password = "secret" }
          |  }
          |]
          |""".stripMargin))
      val hosts = new HostsImpl(conf)
      hosts.getHost("secured").flatMap(_.authentication) must beSome(OpenSearchAuth("admin", "secret"))
    }

    "return empty bookmarks when hosts is missing" in {
      val hosts = new HostsImpl(Configuration(ConfigFactory.parseString("")))
      hosts.getBookmarks() must beEmpty
      hosts.bookmarksJson.value must beEmpty
    }
  }
}
