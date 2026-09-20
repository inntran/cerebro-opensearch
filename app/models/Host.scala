package models

case class Host(
  name: String,
  authentication: Option[OpenSearchAuth] = None,
  headersWhitelist: Seq[String] = Seq.empty,
  tls: Option[ClientTls] = None
)
