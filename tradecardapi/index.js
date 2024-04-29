// configure your Express server, set up environment variables using dotenv,
// and import necessary modules for handling web requests and database connections.
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const mysql = require("mysql2");
const expressSession = require("express-session");
const cookieParser = require("cookie-parser");

const PORT = process.env.PORT || 4000;
app.set("view engine", "ejs");

app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(cookieParser());
app.use(cors());
app.use(
  expressSession({
    secret: "your-secret-key",
    saveUninitialized: false,
    resave: false,
  })
);

// sets up the database connection
const connection = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PW,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 10,
  port: process.env.DB_PORT,
  multipleStatements: true,
});

// get database connection
connection.getConnection((err) => {
  if (err) return console.log(err.message);
  console.log("connected to local mysql db using .env properties");
});

// This returns all the sets of pokemon cards that we have in the card_set table of our database
app.get("/sets", (req, res) => {
  let allSets = `SELECT * FROM card_set`;
  connection.query(allSets, (err, data) => {
    if (err) throw err;
    res.json({ data });
  });
});

// This returns all the pokemon cards that we have in the card table of our database
app.get("/app", (req, res) => {
  let allPokemon = `SELECT card.*, card_set.name as set_name FROM card JOIN card_set ON card.set_id = card_set.set_id`;
  connection.query(allPokemon, (err, data) => {
    if (err) throw err;
    res.json({ data });
  });
});

// This selects a single card from the card table based on the card_id that is searched
app.get("/app/:rowid", (req, res) => {
  let r_id = req.params.rowid;
  let getcard = `SELECT * FROM card WHERE card_id=${r_id}`;
  connection.query(getcard, (err, cardData) => {
    if (err) throw err;

    connection.query(
      "SELECT * FROM abilities WHERE card_id = ?",
      [r_id],
      (err, abilitiesData) => {
        if (err) throw err;

        connection.query(
          "SELECT * FROM weaknesses WHERE card_id = ?",
          [r_id],
          (err, weaknessesData) => {
            if (err) throw err;

            connection.query(
              "SELECT * FROM attacks WHERE card_id = ?",
              [r_id],
              (err, attacksData) => {
                if (err) throw err;

                connection.query(
                  "SELECT * FROM resistances WHERE card_id = ?",
                  [r_id],
                  (err, resistancesData) => {
                    if (err) throw err;

                    // Send the data as a JSON response
                    res.json({
                      cardData,
                      abilitiesData,
                      weaknessesData,
                      attacksData,
                      resistancesData,
                    });
                  }
                );
              }
            );
          }
        );
      }
    );
  });
});

// Express route for adding a card to the collection
app.post("/add-to-collection", (req, res) => {
  let user_id = req.body.user_id;
  let card_id = req.body.card_id;

  console.log("Adding card to collection...");
  console.log("User ID:", user_id);
  console.log("Card ID:", card_id);

  // Construct your SQL query to insert the data into the collection table
  let addToCollectionQuery = `INSERT INTO collection (user_id, card_id) VALUES (?, ?)`;

  // Execute the query with the user_id and card_id values
  connection.query(addToCollectionQuery, [user_id, card_id], (err, result) => {
    if (err) {
      console.error("Error adding card to collection:", err);
      res
        .status(500)
        .json({ success: false, error: "Failed to add card to collection" });
    } else {
      // If the query executes successfully, send a success response
      console.log("Card added to collection successfully.");
      res.status(200).json({ success: true });
    }
  });
});

app.get("/collection/:user_id", (req, res) => {
  let user_id = req.params.user_id;
  let getCollection = `SELECT card.* FROM collection JOIN card ON collection.card_id = card.card_id WHERE collection.user_id = ?`;
  connection.query(getCollection, [user_id], (err, data) => {
    if (err) throw err;
    res.json({ data });
  });
});

// This allows a user to sign up for the website and have an account created in the user table of the database
app.post("/signup", (req, res) => {
  let email = req.body.email;
  let firstName = req.body.firstName;
  let lastName = req.body.lastName;
  let password = req.body.password;

  // Check if email already in database
  let checkEmail = `SELECT * FROM user WHERE email = '${email}'`;
  connection.query(checkEmail, (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Error checking email" });
    }

    if (data.length > 0) {
      // User with this email already exists
      return res.status(400).json({ message: "Email already in use" });
    }

    // If email does not exist, create new user
    let addUser = `INSERT INTO user (email, first_name, last_name, password, role) 
                           VALUES('${email}', '${firstName}', '${lastName}', '${password}', "user"); `;
    connection.query(addUser, (err, data) => {
      if (err) {
        res.status(500).json({ err });
        throw err;
      }

      if (data) {
        // Return a success status
        res.status(200).end();
      }
    });
  });
});

// allows a user to login using stored user credentials from the database
app.post("/login", (req, res) => {
  let email = req.body.email;
  let password = req.body.password;

  let checkUser = `SELECT * FROM user WHERE email = '${email}' AND password = '${password}'`;

  connection.query(checkUser, (err, data) => {
    if (err) {
      console.error(err);
      res.redirect("/login"); // Redirect to login page on error
    } else {
      if (data.length > 0) {
        req.session.user = {
          ...data[0],
        };
        console.log(req.session.user);
        req.session.save((err) => {
          if (err) {
            console.error(err);
            res.redirect("/login"); // Redirect to login page on error
          } else {
            res.status(200).json({ user: req.session.user }); // Redirect to viewsets page on successful login
          }
        });
      } else {
        res.redirect("http://localhost:3000/login"); // Redirect back to login page if login fails
      }
    }
  });
});

// Fetches the user details from the database based on the user's ID stored in the session
app.get("/user", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not logged in" });
  }

  let getUser = `SELECT * FROM user WHERE id = ${req.session.userId}`;

  connection.query(getUser, (err, data) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: "Error fetching user details" });
    } else {
      if (data.length > 0) {
        res.json(data[0]);
      } else {
        res.status(404).json({ message: "User not found" });
      }
    }
  });
});

// This allows a user to add a card to the card table of the database, lock off to admin if used
app.post("/app/add", (req, res) => {
  let name = req.body.nameField;
  let img = req.body.imgField;
  let hitpoints = req.body.hitpointsField;
  let rarity = req.body.rarityField;
  let illustrator = req.body.illustratorField;
  let setId = req.body.setIdField;

  let addCard = `INSERT INTO card (name, img, hitpoints, rarity, illustrator, set_id) 
                     VALUES('${name}', '${img}', ${hitpoints}, '${rarity}', '${illustrator}', ${setId}); `;

  connection.query(addCard, (err, data) => {
    if (err) {
      res.json({ err });
      throw err;
    }

    if (data) {
      let respObj = {
        id: data.insertId,
        name: name,
        message: `${name} card added to collection`,
      };
      res.json({ respObj });
    }
  });
});

// Starts the api and listen for HTTP requests on port 4000
const server = app.listen(PORT, () => {
  console.log(`API started on port ${server.address().port}`);
});
