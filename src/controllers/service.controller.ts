const { PrismaClient } = require('@prisma/client');
import { NextFunction, Request, Response } from "express";

const getServicePage = async (req : Request , res : Response) => {
    res.render("client/service/show.ejs")
}

export {
    getServicePage
}