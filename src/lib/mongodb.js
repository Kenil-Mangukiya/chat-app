import { config } from "@/config/config"
import {MongoClient} from "mongodb"

const client = new MongoClient(config.mongodbUri)

const clientPromise = client.connect()

export default clientPromise