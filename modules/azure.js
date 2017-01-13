var scripty = require('azure-scripty'),
  conf = require('./config'),
  RSVP = require('rsvp'),
  debug = require('debug')('arm-validator:azure'),
  mongoHelper = require('./mongo_helper');

var invoke = RSVP.denodeify(scripty.invoke);

exports.login = function () {
  var cmd = {
      command: 'login --service-principal',
      username: conf.get('AZURE_CLIENT_ID'),
      password: conf.get('AZURE_CLIENT_SECRET'),
      tenant: conf.get('AZURE_TENANT_ID')
    },
    arm = {
      command: 'config mode arm'
    };
  return invoke.call(scripty, cmd)
    .then(invoke.call(scripty, arm));
};

exports.validateTemplate = function (templateFile, parametersFile) {
  var cmd = {
    command: 'group template validate',
    'resource-group': conf.get('TEST_RESOURCE_GROUP_NAME'),
    'template-file': templateFile,
    'parameters-file': parametersFile
  };
  console.log('console.log: using template file:');
  console.log(templateFile);
  console.log('using parameters:');
  console.log(parametersFile);
  return invoke.call(scripty, cmd);
};

function createGroup(groupName) {
  console.log('creating resource group: ' + groupName + ' in region ' + conf.get('AZURE_REGION'));
  var cmd = {
    command: 'group create',
    positional: [groupName, conf.get('AZURE_REGION')]
  };
  return invoke.call(scripty, cmd);
}

exports.deleteExistingGroups = function () {
  return mongoHelper.connect()
    .then(db => {
      var resourceGroups = db.collection('resourceGroups');
      var find = RSVP.denodeify(resourceGroups.find);
      return find.call(resourceGroups, {});
    })
    .then(results => {
      var promises = [];
      results.forEach(result => {
        var promise = exports.deleteGroup(result.name);
        promises.push(promise);
      });

      return RSVP.all(promises);
    });
};

exports.deleteGroup = function (groupName) {
  var cmd = {
    command: 'group delete',
    quiet: '',
    positional: [groupName]
  };
  // first, remove tracking entry in db
  return mongoHelper.connect()
    .then(db => {
      console.log('deleting resource group: ' + groupName);
      var resourceGroups = db.collection('resourceGroups');
      var deleteOne = RSVP.denodeify(resourceGroups.deleteOne);
      return deleteOne.call(resourceGroups, {
        name: groupName
      });
    })
    .then(() => invoke.call(scripty, cmd))
    .then(() => console.log('sucessfully deleted resource group: ' + groupName));
};


exports.validatefailTest = function(templateFile, parametersFile, rgName) {
  console.log('console.log: using template file:');
  console.log(templateFile);
  console.log('using paramters:');
  console.log(parametersFile);
  console.log('Deploying Failsafe to RG: ' + rgName);
  return mongoHelper.connect()
    .then(db => {
      var resourceGroups = db.collection('resourceGroupsupdated');
      var insert = RSVP.denodeify(resourceGroups.insert);
      return insert.call(resourceGroups, {
        name: rgName,
        region: rgName
      });
    })
    .then(result => {
      console.log('sucessfully inserted ' + result.ops.length + ' resource group to collection');
      return createGroup(rgName);
    })
    .then(() => {
      console.log('sucessfully created resource group ' + rgName);

      var cmd = {
        command: 'network vnet create',
        'resource-group': rgName,
        'virtual-network':"newvnet",
        'location': "west us"
      };

      // now call the function!
      return invoke.call(scripty, cmd);
    });
};


exports.validatefailTestHard = function(rgName) {
  return mongoHelper.connect()
    .then(db => {
      var resourceGroups = db.collection('resourceGroupsupdated');
      var insert = RSVP.denodeify(resourceGroups.insert);
      return insert.call(resourceGroups, {
        name: rgName,
        region: rgName
      });
    })
    .then(result => {
      console.log('sucessfully inserted ' + result.ops.length + ' resource group to collection');
      // return createGroup(rgName);
    })
    .then(() => {
      console.log('sucessfully created resource group ' + rgName);

      var cmd = {
        command: 'network vnet create existinVNET',
        'resource-group': rgName,
        'location': "westus"
      };

      // now call the function!
      return invoke.call(scripty, cmd);
    });
};



exports.testTemplate = function (templateFile, parametersFile, rgName) {
  console.log('console.log: using template file:');
  console.log(templateFile);
  console.log('using paramters:');
  console.log(parametersFile);
  console.log('Deploying to RG: ' + rgName);

  return mongoHelper.connect()
    .then(db => {
      var resourceGroups = db.collection('resourceGroups');
      var insert = RSVP.denodeify(resourceGroups.insert);
      return insert.call(resourceGroups, {
        name: rgName,
        region: rgName
      });
    })
    .then(result => {
      console.log('sucessfully inserted ' + result.ops.length + ' resource group to collection');
      return createGroup(rgName);
    })
    .then(() => {
      console.log('sucessfully created resource group ' + rgName);

      validatefailTestHard(rgName);

      var cmd = {
        command: 'group deployment create',
        'resource-group': rgName,
        'template-file': templateFile,
        'parameters-file': parametersFile
      };
      // now deploy!
      return invoke.call(scripty, cmd);
    });
};
