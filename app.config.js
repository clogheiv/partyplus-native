module.exports = ({ config }) => {
  const isDevelopmentBuild = process.env.PARTYPLUS_APP_VARIANT === "development";

  if (!isDevelopmentBuild) {
    return config;
  }

  return {
    ...config,
    name: "PartyPlus Dev",
    android: {
      ...config.android,
      package: "com.partyplus.app.dev",
    },
  };
};
