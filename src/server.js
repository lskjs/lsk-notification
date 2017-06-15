import { autobind } from 'core-decorators';
import getModels from './models';

import Expo from 'exponent-server-sdk';

export default (ctx) => {
  return class NotificationModule {

    async init() {
      this.models = getModels(ctx);
      this.config = ctx.config.rating;
    }
    async run() {
      this.ws = ctx.app.ws('/api/module/notification')
        .on('connection', this.onSocket);
      ctx.app.use('/api/module/notification', this.getApi());

      this.sendPushNotification();
    }


    sendPushNotification() {
      console.log(1111111);
      const somePushToken = 'ExponentPushToken[rDP4qaKsQi8jy_wV90lk_h]';
      // let isPushToken = Expo.isExponentPushToken(somePushToken);
      // Create a new Expo SDK client
      let expo = new Expo();

      // To send push notifications -- note that there is a limit on the number of
      // notifications you can send at once, use expo.chunkPushNotifications()
      (async function() {
        try {
          let receipts = await expo.sendPushNotificationsAsync([{
            // The push token for the app user to whom you want to send the notification
            to: somePushToken,
            sound: 'default',
            body: 'This is a test notification',
            data: {withSome: 'data'},
          }]);
          console.log({receipts});
        } catch (error) {
          console.error({error});
        }
      })();
    }

    async notify(params) {
      // console.log('notify', params);
      const { Notification } = this.models;
      let notification = new Notification(params);
      await notification.save();
      if (params.userId) {
        const room = this.getRoomName(params.userId);
        notification = await this.populate(notification);
        this.emit({ room, data: notification });
      }
      return notification;
    }

    getRoomName(userId) {
      return `user_${userId}`;
    }

    emit({ room, data, action = 'notification' }) {
      return this.ws.to(room).emit(action, data);
    }

    @autobind
    onSocket(socket) {
      const { req } = socket;
      // console.log('Connected!', req.user._id);
      if (!req.user || !req.user._id) throw new Error('Not Auth');
      const roomName = this.getRoomName(req.user._id);
      socket.join(roomName);
    }

    @autobind
    async populate(notification) {
      const { Notification } = this.models;
      try {
        await Notification.populate(notification, {
          path: 'object',
          model: notification.objectType,
        });
      } catch (err) {}
      try {
        await Notification.populate(notification, {
          path: 'subject',
          model: notification.subjectType,
        });
      } catch (err) {}
      return notification;
    }

    getApi() {
      const api = ctx.asyncRouter();
      const { isAuth } = ctx.middlewares;
      const { Notification } = this.models;
      // Поиск
      api.get('/', isAuth, async (req) => {
        const userId = req.user._id;
        const params = req.allParams();
        const notifications = await Notification.find({
          userId,
          ...params,
        });
        return await Promise.each(notifications, this.populate);
      });
      api.post('/', isAuth, async (req) => {
        const params = req.allParams();
        return this.notify(params);
      });
      api.post('/view/:id', isAuth, async (req) => {
        // const userId = req.user._id;
        const notification = await Notification
        .findById(req.params.id)
        .then(ctx.helpers.checkNotFound);
        if (notification.viewedAt) return notification;
        notification.viewedAt = new Date();
        return notification.save();
      });
      api.put('/:id', isAuth, async (req) => {
        const params = req.allParams();
        const comment = await Notification
        .findById(params.id)
        .then(ctx.helpers.checkNotFound);
        Object.assign(comment, params);
        return comment.save();
      });
      api.delete('/:id', isAuth, async (req) => {
        const params = req.allParams();
        const notification = await Notification
        .findById(params.id)
        .then(ctx.helpers.checkNotFound);
        return notification.remove();
      });
      return api;
    }
  };
};
