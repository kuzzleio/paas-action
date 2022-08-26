export declare type ActionInputs = {
    username: string;
    password: string;
    project?: string;
    environment: string;
    application: string;
    image?: string;
    paas_api?: string;
    login_only: boolean;
};
export declare class Action {
    private inputs;
    private jwt?;
    constructor();
    run(): Promise<void>;
    private login;
    private deploy;
}
