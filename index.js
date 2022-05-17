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

const verifyJwt = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "unAuthorize access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.SECRET_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    if (decoded) {
      req.decoded = decoded;
      next();
    }
  });
};

const run = async () => {
  try {
    await client.connect();
    const serviceCollection = client.db("doctors_db").collection("tritment");
    const bookingCollection = client.db("doctors_db").collection("booking");
    const userCollection = client.db("doctors_db").collection("users");
    const doctorCollection = client.db("doctors_db").collection("doctors");

    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded;
      console.log(decodedEmail);
      const requester = await userCollection.findOne({ email: decodedEmail });
      if (requester.role === "admin") {
        next();
      } else {
        return res.status(403).send({ message: "request forbidden" });
      }
    };

    app.get("/service", async (req, res) => {
      const query = {};
      const service = await serviceCollection
        .find(query)
        .project({ name: 1 })
        .toArray();
      res.send(service);
    });

    /* post a doctor data */
    app.post("/doctor", verifyJwt, verifyAdmin, async (req, res) => {
      const doctor = req.body;
      const exist = await doctorCollection.findOne({
        email: doctor.email,
        name: doctor.name,
      });
      if (exist) {
        return res.send({ message: "doctor information already exist" });
      }
      const result = await doctorCollection.insertOne(doctor);
      res.send(result);
    });

    /* get all user in database */
    app.get("/users", verifyJwt, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    /* make an admin role */
    app.put("/user/admin/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    /* what user is admin check */
    app.get("/admin/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });

    /* user data stored in database */
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const token = jwt.sign(email, process.env.SECRET_TOKEN);
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      console.log(token);
      res.send({ result, token });
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
    app.get("/booking", verifyJwt, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const decodedEmail = req.decoded;
      if (email === decodedEmail) {
        const booking = await bookingCollection.find(query).toArray();
        res.send(booking);
      } else {
        res.status(403).send({ message: "forbidden access" });
      }
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
