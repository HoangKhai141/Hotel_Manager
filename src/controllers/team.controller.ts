const { PrismaClient } = require('@prisma/client');
import { NextFunction, Request, Response } from "express";

const getTeamPage = async (req : Request , res : Response) => {
    res.render("client/team/show.ejs")
}

export {
    getTeamPage
}