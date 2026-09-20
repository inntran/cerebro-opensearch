name := "cerebro"

organization := "io.github.inntran"

maintainer := "inntran <562997+inntran@users.noreply.github.com>"

packageSummary := "OpenSearch / OpenSearch web admin tool"

packageDescription := """cerebro-opensearch is an open source (MIT License) cluster web admin tool built
  using Scala, Play Framework and AngularJS."""

version := "1.0.0-SNAPSHOT"

ThisBuild / javacOptions ++= Seq("--release", "25")
ThisBuild / scalacOptions ++= Seq("-release", "25", "-deprecation", "-feature")
// scalaVersion is set in github-actions.sbt / ThisBuild for workflow generation

libraryDependencies ++= Seq(
  guice,
  ws,
  filters,
  "org.playframework" %% "play-json"             % "3.0.5",
  "org.playframework" %% "play-slick"            % "6.2.0",
  "org.playframework" %% "play-slick-evolutions" % "6.2.0",
  "org.xerial"         %  "sqlite-jdbc"          % "3.49.1.0",
  "org.apache.httpcomponents.client5" % "httpclient5" % "5.5.2",
  "org.specs2"        %% "specs2-core"           % "4.20.9" % Test,
  "org.specs2"        %% "specs2-junit"          % "4.20.9" % Test,
  "org.specs2"        %% "specs2-mock"           % "4.20.9" % Test
)

lazy val root = (project in file("."))
  .enablePlugins(PlayScala, BuildInfoPlugin, JavaAppPackaging, LauncherJarPlugin)
  .settings(
    buildInfoKeys := Seq[BuildInfoKey](name, version, scalaVersion, sbtVersion),
    buildInfoPackage := "models",
    Compile / doc / sources := Seq.empty,
    Compile / mainClass := Some("bootstrap.CerebroApp"),
    pipelineStages := Seq(gzip)
  )

// Controller specs initialize Slick directly, without going through CerebroApp's
// production bootstrap. Supply test-only equivalents for its data directory and
// session secret so tests work on a fresh checkout without external configuration.
Test / testOptions += Tests.Setup(() => {
  val dataPath = sys.props.get("data.path")
    .orElse(sys.env.get("CEREBRO_DATA"))
    .getOrElse("./data")
  IO.createDirectory(file(dataPath))
})

// Play's tests run in a forked JVM, so an sbt-process sys.props update would not
// reach them. This fixed value is only for tests, never packaged or used at runtime.
Test / javaOptions += "-Dplay.http.secret.key=0123456789abcdef0123456789abcdef0123456789abcdef"
