import UniversalSchema from 'lego-starter-kit/utils/UniversalSchema';
// subjectType
// subjectId
// subject: // populated
// action: '' // ENUM
// userId
// objectType
// objectId
// object: // populated
// createdAt
// viewedAt //
export function getSchema(ctx) {
  const mongoose = ctx.db;
  const schema = new UniversalSchema({
    subjectId: {
      type: String,
      index: true,
      required: true,
    },
    subjectType: {
      type: String,
      index: true,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      required: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    objectType: {
      type: String,
      index: true,
    },
    objectId: {
      type: String,
      index: true,
    },
    info: {
      type: Object,
      default: {},
    },
    viewedAt: {
      type: Date,
      default: null,
    },
  }, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  });

  schema.virtual('user', {
    ref: 'User', // The model to use
    localField: 'userId', // Find people where `localField`
    foreignField: '_id', // is equal to `foreignField`,
    justOne: true,
  });
  schema.virtual('subject', {
    localField: 'subjectId', // Find people where `localField`
    foreignField: '_id', // is equal to `foreignField`,
    justOne: true,
  });
  schema.virtual('object', {
    localField: 'objectId', // Find people where `localField`
    foreignField: '_id', // is equal to `foreignField`,
    justOne: true,
  });

  schema.methods.send = async function () {
    return {};
  };
  schema.statics.prepareOne = async function (notification) {
    return notification;
    try {
      await this.populate(notification, {
        path: 'object',
        model: notification.objectType,
      });
    } catch (err) {}
    try {
      await this.populate(notification, {
        path: 'subject',
        model: notification.subjectType,
      });
    } catch (err) {}
    return notification;
  };

  // await Promise.each(notifications, this.populate);
  return schema;
}

export default(ctx) => {
  return ctx.db.model('Notification', getSchema(ctx).getMongooseSchema(), 'notifications');
};
