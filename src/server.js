import { autobind } from 'core-decorators';
import _ from 'lodash';
import getModels from './models';
import Expo from 'exponent-server-sdk';

export default (ctx) => {
  return class NotificationModule {

    async init() {
      this.models = getModels(ctx);
      this.config = ctx.config.notification || {};
      this.expo = new Expo();
    }

    async run() {
      this.ws = ctx.app.ws('/api/module/notification')
        .on('connection', this.onSocket);
      ctx.app.use('/api/module/notification', this.getApi());
      // const tokens = [
      //   'ExponentPushToken[rDP4qaKsQi8jy_wV90lk_h]',
      //   'ExponentPushToken[LgGcorMcbyL-oM8BwbhZaP]',
      // ]
      //
      //
      // tokens.forEach(token => this.sendPushNotification(token))
    }

    async getNotificationCount(userId) {
      // console.log('getNotificationCount', userId);
      if (!ctx.modules.chat) return 0;
      // const { User } = ctx.models;
      const { Chat, Message } = ctx.modules.chat.models;
      const user = { _id: userId };

      let chats = await Chat.find({
        type: 'private',
        userIds: { $all: [userId] },
      });
      // const totalCount = true;
      // console.log('this.config.totalCount', this.config.totalCount, this.config);
      if (this.config.totalCount) {
        let viewedAts = chats.map((item) => {
          const viewedAt = (item.usersViewedAt || {})[userId];
          return {
            _id: item._id,
            viewedAt,
          };
        });
        // .filter(i => i.viewedAt)


        // console.log(11, { viewedAts });

        viewedAts = await Promise.map(viewedAts, async ({ _id, viewedAt }) => {
          const criteria = {
            subjectType: 'Chat',
            subjectId: _id,
            userId: { $ne: userId },
            // createdAt: { $gte: viewedAt },
          };
          if (viewedAt) {
            criteria.createdAt = { $gte: viewedAt };
          }
          // console.log({criteria});
          const count = await Message.count(criteria);

          return {
            _id,
            viewedAt,
            count,
          };
        });
        // console.log(222, { viewedAts });

        return _.sumBy(viewedAts, 'count') || 0;
      }

      // console.log({chats});
      chats = await Chat.prepare(chats);
      chats = chats.filter(c => c.message != null);
      chats = chats.filter((item) => {
        const { message } = item;
        const viewedAt = (item.usersViewedAt || {})[userId];

        // console.log('@@@0', item._id);
        // console.log('@@@1', String(userId) !== String(message.userId));
        // console.log('@@@2', viewedAt && new Date(message.createdAt) > new Date(viewedAt));

        let unread = false;

        if (String(userId) !== String(message.userId) && viewedAt && new Date(message.createdAt) > new Date(viewedAt)) {
          unread = true;
        }
        // console.log('@@@3', unread);

        return unread;
      });

      // console.log({chats});

      return chats.length;
    }


    async sendPushNotification(token, params = {}) {
      // console.log('sendPushNotification', token);
      let tokens;
      if (Array.isArray(token)) {
        tokens = token;
      } else {
        tokens = [token];
      }

      // console.log('sendPushNotification', {params});
      // const badge = await this.getNotificationCount(_.get(params, 'data.subjectId'))
      // console.log('sendPushNotification', data);

      const packs = tokens.map(to => ({
        sound: 'default',
        body: 'Вам пришло новое сообщение',
        // badge,
        // data: { qwe: 123123 },
        ...params,
        to,
      }));

      return this.expo.sendPushNotificationsAsync(packs);
    }

    @autobind
    async notify(params) {
      // console.log('notify', params, ctx.);
      // console.log(111);
      const { User } = ctx.models;
      // console.log(222);
      const { Notification } = this.models;
      // console.log(333);

      let notification = new Notification(params);
      await notification.save();
      if (params.userId) {
        const room = this.getRoomName(params.userId);
        notification = await this.populate(notification);
        const badge = await this.getNotificationCount(params.userId);
        // console.log(23456789,{badge, notification});
        // this.emit({ room, data: notification });
        this.emit({ room, data: { ...notification.toObject(), badge } });

        if (this.config) {
          const user = await User.findById(params.userId);
          // console.log({ user, params });
          if (user.private && user.private.pushTokens && user.private.pushTokens.length) {
            const data = {
              data: params,
              badge,
            };
            if (params.message) {
              data.body = params.message;
            }
            this.sendPushNotification(user.private.pushTokens, data);
          }
        }
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
      // if (!req.user) {
      //   __DEV__ && console.log({req});
      // }
      if (!req.user || !req.user._id) throw new Error('Not Auth');
      // __DEV__ && console.log('notification.onSocket @@@', req.user._id);
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
      api.post('/addPushToken', isAuth, async (req) => {
        // console.log('/addPushToken', req.data.pushToken);
        const { pushToken } = req.data;
        if (!pushToken) throw '!pushToken';
        const { User } = ctx.models;
        const userId = req.user._id;
        const user = await User.findById(userId);
        if (user.private) {
          user.private = {};
        }

        const pushTokens = user.private.pushTokens || [];

        if (pushTokens.indexOf(pushToken) === -1) {
          pushTokens.push(pushToken);
        }
        user.private = {
          ...user.private,
          pushTokens,
        };
        return user.save();
      });
      api.get('/count', isAuth, async (req) => {
        // console.log(111);
        const userId = req.user._id;
        const count = await this.getNotificationCount(userId);
        // console.log({count});
        return count;
      });
      api.get('/', isAuth, async (req) => {
        const userId = req.user._id;
        const params = req.allParams();

        const notifications = await Notification.findByParams({
          filter: {
            userId,
            ...params,
          },
        });
        // const notifications = await Notification.find({
        //   userId,
        //   ...params,
        // });
        return Notification.prepare(notifications);// await Promise.each(notifications, this.populate);
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
