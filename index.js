const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;
const app = express()

// middleware
const corsOptions = { origin: ['http://localhost:5173'], credentials: true }
app.use(express.json());
app.use(cors(corsOptions))
app.use(cookieParser())

// verity jwt middleware
const verifyToken = async (req, res, next) => {
    const token = req?.cookies?.token;
    if (!token) { return res.status(401).send({ message: 'Unauthorized access' }) }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {return res.status(401).send({ message: 'unauthorized access' })}
        req.user = decoded
        next()
    })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cy5pfmj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const foodsCollection = client.db('foodDB').collection('Foods')
        const requestsCollection = client.db('foodDB').collection('requests')

        // JWT GENERATE
        app.post('/jwt', async (req, res) => {
            const userEmail = req.body;
            const token = jwt.sign(userEmail, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5h' })
            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
                })
                .send({ success: true })
        })

        // clear token
        app.get('/logout', (req, res) => {
            res
                .clearCookie('token', {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                    maxAge: 0
                })
                .send({ success: true })
        })

        // request related
        app.post('/requestAdd', async (req, res) => {
            // add in requestsCollection
            const requestData = req.body;
            const result = await requestsCollection.insertOne(requestData)

            // delete from foodsCollection
            const deleteId = requestData?.food_id;
            const deleteQuery = { _id: new ObjectId(deleteId) }
            const deleteResult = await foodsCollection.deleteOne(deleteQuery)
            res.send(result)
        })

        app.get('/requestedFood/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { requester_email: email }
            const result = await requestsCollection.find(query).toArray()
            res.send(result)
        })

        // food related
        app.post('/addFood', async (req, res) => {
            const foodData = req.body;
            const result = await foodsCollection.insertOne(foodData)
            res.send(result)
        })
        // get foods by sorting and search
        app.get('/all-foods', async (req, res) => {
            const sort = req.query.sort;
            const search = req.query.search;

            let query = {}
            if (search) query = { food_name: { $regex: search, $options: 'i' } }

            let options = {}
            if (sort) options = { sort: { expired_date: sort === 'asc' ? 1 : -1 } }

            const result = await foodsCollection.find(query, options).toArray()
            res.send(result)
        })

        app.get('/all', async (req, res) => {
            const result = await foodsCollection.find().toArray();
            res.send(result)
        })

        // get foods by id
        app.get('/food/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await foodsCollection.findOne(query);
            res.send(result)
        })

        // get foods by email safjlasd;fjasfj
        app.get('/foods/:email', verifyToken, async (req, res) => {
            const tokenEmail = req.user.email;
            const email = req.params.email;
            if (tokenEmail !== email) return res.status(401).send({ message: 'forbidden access saf' })
            const query = { 'donor.donor_email': email }
            const result = await foodsCollection.find(query).toArray()
            res.send(result)
        })

        // update food
        app.patch('/update/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const newUpdate = req.body
            const updateDoc = {
                $set: newUpdate
            }
            const result = await foodsCollection.updateOne(query, updateDoc)
            res.send(result)
        })

        // delete food
        app.delete('/delete/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await foodsCollection.deleteOne(query)
            res.send(result)
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('RFood is running')
})


app.listen(port, () => {
    console.log('This server is running on server', port);
})
