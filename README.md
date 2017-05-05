# LSK Notification module


```js
POST /api/module/notification --- создать нотификацию (для тестов)
body {
  subjectId: 'id главный',
  subjectType: 'id главной модели',
  objectId: 'id',
  objectType: 'id модели',
  userId: 'Кому присылается сообщение'
}
```

```js
GET /api/module/notification --- (запросить список нотификаций)
result [
  {
    subjectId: 'id главный',
    subjectType: 'id главной модели',
    objectId: 'id',
    objectType: 'id модели',
    userId: 'Кому присылается сообщение',
    object: Populate Object,
    subject: Populate Subject,
    user: Populate user
  }
]
```

```js
POST /:id/view --- Уведомить о просмотре нотификации
id - id нотификации


Для примера можно пересылать сообщения
```
