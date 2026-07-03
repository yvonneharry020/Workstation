const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(__dirname, '../..')

const config = getDefaultConfig(projectRoot)

// Watch all files in the monorepo
config.watchFolders = [workspaceRoot]

// Let Metro find packages in both local and workspace node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

// pnpm stores packages as symlinks — Metro must follow them to resolve the real files
config.resolver.unstable_enableSymlinks = true

// Force React singletons to a single instance across the monorepo.
// Without this, pnpm symlinks can cause two copies of React in the bundle (invalid hook call).
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, 'node_modules/react'),
  'react-dom': path.resolve(projectRoot, 'node_modules/react-dom'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
  'react/jsx-runtime': path.resolve(projectRoot, 'node_modules/react/jsx-runtime'),
  'react/jsx-dev-runtime': path.resolve(projectRoot, 'node_modules/react/jsx-dev-runtime'),
}

// Fix pnpm monorepo bundle URL issue:
// Metro puts the real pnpm store path in the HTML script src (e.g. /../../node_modules/.pnpm/...)
// Browsers strip the /../.. making it /node_modules/.pnpm/... which Metro can't find.
// This middleware restores the ../../ so Metro can locate the file.
config.server = {
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      if (
        req.url &&
        req.url.startsWith('/node_modules/.pnpm/') &&
        (req.url.includes('.bundle') || req.url.includes('.map'))
      ) {
        req.url = '/../../' + req.url.slice(1)
      }
      return middleware(req, res, next)
    }
  },
}

// Stub @opentelemetry/api — dynamically imported by supabase-js but not available in RN
const originalResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@opentelemetry/api') {
    return {
      filePath: path.resolve(__dirname, 'mocks/opentelemetry-api.js'),
      type: 'sourceFile',
    }
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = withNativeWind(config, { input: './global.css' })
