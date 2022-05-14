const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;

/* middleware */
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.3zjl8.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const run = async () => {
  try {
    await client.connect();
    const serviceCollection = client.db("doctors_db").collection("tritment");
    const bookingCollection = client.db("doctors_db").collection("booking");

    /* gwt token created */
    app.post("/login", (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.SECRET_TOKEN);
      res.send({ token });
    });

    app.get("/service", async (req, res) => {
      const query = {};
      const service = await serviceCollection.find(query).toArray();
      res.send(service);
    });

    /* post booking data in database */
    app.post("/booking", async (req, res) => {
      const bookingApointment = req.body;
      const query = {
        tritment: bookingApointment.tritment,
        date: bookingApointment.date,
        email: bookingApointment.email,
      };
      const exist = await bookingCollection.findOne(query);
      if (exist) {
        return res.send({ success: false, booking: exist });
      }
      const result = await bookingCollection.insertOne(bookingApointment);
      res.send({ success: true, result });

      console.log(bookingApointment);
    });

    app.get("/available", async (req, res) => {
      const date = req.query.date;
      const services = await serviceCollection.find({}).toArray();
      const query = { date: date };
      const booking = await bookingCollection.find(query).toArray();
      services.forEach((service) => {
        const serviceBooking = booking.filter(
          (book) => book.tritment === service.name
        );
        const bookSlots = serviceBooking.map((book) => book.slot);
        const available = service.slots.filter(
          (slot) => !bookSlots.includes(slot)
        );
        service.slots = available;
      });
      res.send(services);
    });

    /* get paitent booking */
    app.get("/booking", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const booking = await bookingCollection.find(query).toArray();
      res.send(booking);
    });
  } finally {
    // await client.close();
  }
};
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
