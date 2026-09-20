package models

case class OpenSearchAuth(username: String, password: String)

/**
 * Optional TLS material for cluster connections (PEM).
 * - CA-only: trust a private CA / self-signed server cert (no client identity).
 * - mTLS: client cert + key, optionally with a CA for server trust.
 */
case class ClientTls(
  clientCertPem: Option[String] = None,
  clientKeyPem: Option[String] = None,
  caCertPem: Option[String] = None,
  strictCaCheck: Boolean = true
) {
  def hasClientIdentity: Boolean =
    clientCertPem.exists(_.nonEmpty) && clientKeyPem.exists(_.nonEmpty)

  def hasCustomTrust: Boolean =
    caCertPem.exists(_.nonEmpty)
}
