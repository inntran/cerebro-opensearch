package models

case class OpenSearchServer(host: Host, headers: Seq[(String, String)] = Seq.empty)
