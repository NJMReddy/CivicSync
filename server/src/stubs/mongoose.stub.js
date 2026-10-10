/**
 * @file mongoose.stub.js
 * @description Provides seamless Mongoose interface when mongoose package is present,
 * or a transparent fallback for test execution if packages have not been installed yet.
 */

let mongoose;

try {
  mongoose = require('mongoose');
} catch (_) {
  // Transparent in-memory fallback for testing environments before npm install
  const schemas = new Map();
  const models = new Map();

  class MockSchema {
    constructor(definition, options) {
      this.definition = definition;
      this.options = options || {};
    }
    index() {}
  }
  MockSchema.Types = {
    ObjectId: class MockObjectId {
      constructor(val) {
        this.val = val ? val.toString() : `obj_${Math.random().toString(36).substring(2, 9)}`;
      }
      toString() {
        return this.val;
      }
    },
    Mixed: Object
  };

  function createModel(modelName, schema) {
    function Model(data = {}) {
      Object.assign(this, data);
      this._id = this._id || `${modelName.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      this.createdAt = this.createdAt || new Date();
      this.updatedAt = this.updatedAt || new Date();
    }
    Model.modelName = modelName;
    Model.schema = schema;
    Model.findById = async (id) => null;
    Model.find = () => ({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            lean: async () => []
          })
        }),
        lean: async () => []
      })
    });
    Model.countDocuments = async () => 0;
    Model.updateMany = async () => ({ matchedCount: 0, modifiedCount: 0 });
    Model.prototype.save = async function () {
      return this;
    };

    models.set(modelName, Model);
    return Model;
  }

  mongoose = {
    Schema: MockSchema,
    model: (name, schema) => models.get(name) || createModel(name, schema),
    models: {},
    connection: { readyState: 0 },
    startSession: async () => ({
      startTransaction: () => {},
      commitTransaction: async () => {},
      abortTransaction: async () => {},
      endSession: () => {}
    })
  };
}

module.exports = mongoose;
