const Influx = require('influx');
const pg = require('pg');
const connectionStr = {
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: 'xxxx',
  port: 5434
};
const fastifyport = 4000;
const fastifyip = '192.168.1.178';
const fastify = require('fastify')({
  logger: true,
  ignoreTrailingSlash: true
});
fastify
  .register(require('fastify-cors'), {})
  .register(require('fastify-jwt'), { secret: 'supersecret' })

const os = require('os');
var contatore = 0;
const influx = new Influx.InfluxDB({
  host: 'localhost',
  database: 'express_3',
  schema: [
    {
      measurement: 'response_times',
      fields: {
        IdVeicolo: Influx.FieldType.INTEGER,
        StringaVeicolo: Influx.FieldType.STRING,
        TimeStamp: Influx.FieldType.STRING,
        Latitudine: Influx.FieldType.FLOAT,
        Longitudine: Influx.FieldType.FLOAT,
        Altitudine: Influx.FieldType.FLOAT,
        Passeggeri: Influx.FieldType.INTEGER,
        PorteAperte: Influx.FieldType.BOOLEAN
      },
      tags: [
        'host'
      ]
    }
  ]
});
influx.getDatabaseNames()
  .then(names => {
    if (!names.includes('express_3')) {
      return influx.createDatabase('express_3');
    }
  })
  .catch(err => {
    console.error(`Error creating Influx database!`);
  })
fastify.post('/', async (request, reply) => {
  dati = request.body[0];
  await influx.writePoints([
    {
      measurement: 'response_times',
      tags: { host: os.hostname() },
      fields: {
        IdVeicolo: dati.idVehicle,
        StringaVeicolo: dati.description,
        TimeStamp: dati.timeDate,
        Latitudine: dati.latitude,
        Longitudine: dati.longitude,
        Altitudine: dati.altitude,
        Passeggeri: dati.passenger,
        PorteAperte: dati.theDoors
      },
    }
  ]).catch(err => {
    reply.status(500)
    console.error(`Error saving data to InfluxDB! ${err.stack}`)
  }).then(() =>
    console.log("// " + (++contatore)),
    console.log(request.body))
  reply.status(204)
});

//parte in get
fastify.get('/get', async (request, reply) => {
  await influx.query(`
    select * from response_times `)
    .then(result => {
      reply.status(200).send(JSON.stringify(result))
    }).catch(err => {
      reply.status(500).send(err.stack)
    })
})
//////////////////////////////////////////////////////// parte per sito web che gestite le richieste di login e registrazione
fastify.post('/ApplicationUser/Registration', async (request, reply) => {
  const client = new pg.Client(connectionStr);
  var dati = request.body;
  await client.connect()
    .then(() => console.log('client has connect'));
  await client.query(`INSERT INTO utenti (UserName, FullName, Email, Password) VALUES ('${dati.UserName}','${dati.FullName}','${dati.Email}',crypt('${dati.Password}', gen_salt('bf')))`)
    .then(() => {
      client.end()
      console.log('client close without error')
      reply.status(200).send({ succeeded: true });
    }).catch(err => {
      client.end()
      console.log('client close with : ' + err)
      reply.status(500).send(err)
    })
});
fastify.post('/ApplicationUser/Login', async (request, reply) => {
  const client = new pg.Client(connectionStr);
  var dati = request.body;
  await client.connect()
    .then(() => console.log('client has connect'));
  await client.query(`SELECT (Id) FROM utenti WHERE UserName = ('${dati.UserName}') AND Password = crypt ('${dati.Password}', Password)`)
    .then(result => {
      client.end()
      console.log('client close without error')
      if (result.rows.length == 1) {
        var id = { UserID: result.rows[0].id }    //controllo che sia l`id esatto
        const token = fastify.jwt.sign({ id })
        reply.status(200).send({ result, token })
      } else {
        reply.status(400).send({ msg: "Username o password errati" })
      }
    }).catch(err => {
      client.end()
      console.log('client close with : ' + err)
      reply.status(500).send(err)
    })
})
fastify.get('/UserProfile', async (request, reply) => {
  const bearerHeader = request.headers.authorization
  if (typeof bearerHeader !== 'undefined') {
    const token = bearerHeader.split(' ');
    const decoded = fastify.jwt.decode(token[1])
    console.log(decoded.id);
    const client = new pg.Client(connectionStr);
    await client.connect()
      .then(() => console.log('client has connect'));
    await client.query(`SELECT * FROM utenti WHERE Id = ('${decoded.id.UserID}')`)
    .then(result => {
      console.log(result.rows[0])
    reply.code(200).send(result.rows[0])
  })
  }
})
// Run the server!
const start = async () => {
  try {
    await fastify.listen(fastifyport, fastifyip)
    fastify.log.info(`server listening on ${fastify.server.address().port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start();