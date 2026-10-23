plugins {
    id("com.android.application")
}

android {
    namespace = "de.umzora.gecebekcisi"
    compileSdk = 34

    defaultConfig {
        applicationId = "de.umzora.gecebekcisi"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildTypes {
        getByName("debug") {
            // Yan yukleme icin debug imzasi yeterli; Play Console gerekmiyor.
            isMinifyEnabled = false
        }
    }
}
