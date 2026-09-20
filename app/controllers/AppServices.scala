package controllers

import com.google.inject.{ImplementedBy, Inject, Singleton}
import models.security.HostValidator
import play.api.Configuration
import services.audit.AuditService

@ImplementedBy(classOf[AppServicesImpl])
trait AppServices {
  def configuration: Configuration
  def audit: AuditService
  def hostValidator: HostValidator
}

@Singleton
class AppServicesImpl @Inject()(val configuration: Configuration, val audit: AuditService) extends AppServices {
  val hostValidator = new HostValidator(configuration)
}
