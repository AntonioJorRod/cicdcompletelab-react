pipeline {
  agent {
    kubernetes {
      defaultContainer 'node'
      yaml """
apiVersion: v1
kind: Pod
spec:
  serviceAccountName: jenkins
  containers:
  - name: node
    image: node:20
    command:
    - cat
    tty: true
  - name: docker
    image: docker:24-dind
    securityContext:
      privileged: true
  - name: kubectl
    image: bitnami/kubectl:1.30
    command:
    - cat
    tty: true
"""
    }
  }

  environment {
    REGISTRY   = "docker.io/miusuario"
    IMAGE      = "cicdcompletelab-react"
    NAMESPACE  = "frontend"
    APP        = "react-app"
  }

  options {
    timeout(time: 90, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '30'))
    timestamps()
    ansiColor('xterm')
  }

  stages {
    stage('Checkout') {
      steps {
        checkout([
          $class: 'GitSCM',
          branches: [[name: env.BRANCH_NAME]],
          doGenerateSubmoduleConfigurations: false,
          extensions: [
            [$class: 'CloneOption',
            depth: 1,
            shallow: true,
            noTags: false,
            timeout: 10]
          ],
          userRemoteConfigs: [[
            url: 'https://github.com/mi-org/cicdcompletelab-react.git',
            credentialsId: 'github-creds'
          ]]
        ])
      }
    }


    stage('Matrix Build & Test') {
      matrix {
        axes {
          axis {
            name 'NODE_VERSION'
            values '16', '18', '20'
          }
        }
        agent {
          kubernetes {
            defaultContainer 'node'
            yaml """
apiVersion: v1
kind: Pod
spec:
  serviceAccountName: jenkins
  containers:
  - name: node
    image: node:\${NODE_VERSION}
    command:
    - cat
    tty: true
"""
          }
        }
        stages {
          stage('Install & Test') {
            steps {
              sh """
                npm ci
                npm test -- --ci --watchAll=false
              """
            }
            post {
              always {
                junit 'reports/junit/*.xml'
              }
            }
          }
        }
      }
    }

    stage('Lint & Build') {
      parallel {
        stage('Lint') {
          steps { sh 'npm run lint' }
        }
        stage('Build') {
          steps { sh 'npm run build' }
          post {
            success {
              archiveArtifacts artifacts: 'dist/**', fingerprint: true
            }
          }
        }
      }
    }

    stage('SonarQube Quality Gate') {
      steps {
        withSonarQubeEnv('SonarQube') {
          sh 'sonar-scanner -Dsonar.projectKey=react-app'
        }
      }
      post {
        unsuccessful {
          error("❌ Quality Gate failed, aborting pipeline.")
        }
      }
    }

    stage('Security Scans') {
      parallel {
        stage('Snyk') {
          steps { sh 'snyk test || true' }
        }
        stage('Trivy Docker') {
          steps {
            container('docker') {
              sh '''
                docker build -t tmpimage:scan .
                trivy image tmpimage:scan || true
              '''
            }
          }
        }
      }
    }

    stage('Docker Build & Push') {
      steps {
        container('docker') {
          withCredentials([usernamePassword(
            credentialsId: 'dockerhub-creds',
            usernameVariable: 'DOCKER_USER',
            passwordVariable: 'DOCKER_PASS'
          )]) {
            sh '''
              echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
              docker build -t $REGISTRY/$IMAGE:$BUILD_NUMBER .
              docker push $REGISTRY/$IMAGE:$BUILD_NUMBER
            '''
          }
        }
      }
    }

    stage('Canary Deploy') {
      steps {
        container('kubectl') {
          sh '''
            kubectl set image deployment/${APP}-canary ${APP}=$REGISTRY/$IMAGE:$BUILD_NUMBER -n ${NAMESPACE}
            kubectl rollout status deployment/${APP}-canary -n ${NAMESPACE}
          '''
        }
      }
    }

    stage('Canary Validation Tests') {
      steps {
        sh 'npm run test:e2e:canary || true'
      }
    }

    stage('Promote to Production') {
      input message: "¿Promover a PRODUCCIÓN?", ok: "Yes, deploy"
      steps {
        container('kubectl') {
          script {
            try {
              sh '''
                kubectl set image deployment/${APP}-prod ${APP}=$REGISTRY/$IMAGE:$BUILD_NUMBER -n ${NAMESPACE}
                kubectl rollout status deployment/${APP}-prod -n ${NAMESPACE}
              '''
            } catch (err) {
              echo "❌ Error en prod, haciendo rollback"
              sh '''
                kubectl rollout undo deployment/${APP}-prod -n ${NAMESPACE}
              '''
              error("Rollback ejecutado")
            }
          }
        }
      }
    }
  }

  post {
    always {
      cleanWs()
    }
    success {
      slackSend channel: '#ci-cd', message: "✅ Build ${env.BUILD_NUMBER} listo en producción"
    }
    failure {
      slackSend channel: '#ci-cd', message: "❌ Build ${env.BUILD_NUMBER} falló"
    }
  }
}
