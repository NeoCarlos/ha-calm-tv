plugins {
    id("com.android.application")
}

android {
    namespace = "io.github.neocarlos.hacalmtv"
    compileSdk = 35

    defaultConfig {
        applicationId = "io.github.neocarlos.hacalmtv"
        minSdk = 31
        targetSdk = 35
        versionCode = 2
        versionName = "0.2.0"
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.18.0")
}
