module.exports = {
  apps : [{
    script: 'npm start'
  }],

  deploy : {
    production : {
      key: "marileo.pem",
      user : 'ubuntu',
      host : '15.228.57.23',
      ref  : 'origin/main',
      repo : 'https://github.com/hector7178/marileo-bot-server.git',
      path : '/home/ubuntu',
      'pre-deploy-local': '',
      'post-deploy' : 'source ~/nvm/nvm.sh && npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
      'ssh-options':'ForwardAgent=yes'
    }
  }
};
