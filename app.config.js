module.exports = ({ config }) => {
  const variant = process.env.PARTYPLUS_APP_VARIANT;
  const isDevelopmentBuild = variant === "development" || variant === "preview";

  if (!isDevelopmentBuild) {
    return config;
  }

  return {
    ...config,
    name: variant === "preview" ? "PartyPlus Preview" : "PartyPlus Dev",
    scheme: variant === "preview" ? "partyplusnative-preview" : "partyplusnative-dev",
    ios: { ...config.ios, bundleIdentifier: "com.partyplus.app." + (variant === "preview" ? "preview" : "dev") },
    android: {
      ...config.android,
      package: "com.partyplus.app." + (variant === "preview" ? "preview" : "dev"),
    },
  };
};
