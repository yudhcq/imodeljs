/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModelBankClient
 */
import { IModelHubStatus, Logger, WSStatus } from "@bentley/bentleyjs-core";
import { Asset, Project } from "@bentley/context-registry-client";
import { AuthorizedClientRequestContext, request, RequestOptions, Response, WsgError, WsgInstance } from "@bentley/itwin-client";
import { ContextManagerClient } from "../IModelCloudEnvironment";
import { IModelHubClientError } from "../imodelhub/Errors";
import { IModelHubClientLoggerCategory } from "../IModelHubClientLoggerCategories";

const loggerCategory: string = IModelHubClientLoggerCategory.IModelBank;

// Format of the imodelContext.json file found in the root directory of an iModel file system context master directory.
// TODO: Remove this when we
/** @internal */
export interface IModelFileSystemContextProps {
  name: string;
  id: string;
  description: string;
}

/** @internal */
export class IModelBankFileSystemContextClient implements ContextManagerClient {
  constructor(public baseUri: string) {
  }

  private async queryContextProps(requestContext: AuthorizedClientRequestContext, projectName: string): Promise<IModelFileSystemContextProps[]> {
    requestContext.enter();
    const url: string = this.baseUri + "/sv1.0/Repositories/Global--main/GlobalScope/Context";
    requestContext.enter();
    Logger.logInfo(loggerCategory, `Sending GET request to ${url}`);

    const queryOptions = {      // use the same ODATA-style queries that Connect and iModelHub use
      $select: "*",
      $filter: `name+eq+'${projectName}'`,
    };

    const options: RequestOptions = {
      method: "GET",
      headers: { authorization: requestContext.accessToken.toTokenString() },
      qs: queryOptions,
      accept: "application/json",
    };

    const res: Response = await request(requestContext, url, options);
    requestContext.enter();
    if (!res.body || !res.body.instances) {
      return Promise.reject(new Error(`Query to URL ${url} executed successfully, but did NOT return anything.`));
    }

    const props = res.body.instances as WsgInstance[];
    if (props.length === 0)
      return Promise.reject(new WsgError(WSStatus.InstanceNotFound));

    if (props.length !== 1)
      return Promise.reject(new IModelHubClientError(IModelHubStatus.InvalidArgumentError));

    Logger.logTrace(loggerCategory, `Successful GET request to ${url}`);

    return props.map((value) => value.properties as IModelFileSystemContextProps);
  }

  public async queryAssetByName(requestContext: AuthorizedClientRequestContext, assetName: string): Promise<Asset> {
    const props = await this.queryContextProps(requestContext, assetName);
    requestContext.enter();

    const asset = new Asset();
    asset.wsgId = asset.ecId = props[0].id;
    asset.name = props[0].name;
    return Promise.resolve(asset);
  }

  public async queryProjectByName(requestContext: AuthorizedClientRequestContext, projectName: string): Promise<Project> {
    const props = await this.queryContextProps(requestContext, projectName);
    requestContext.enter();

    const project = new Project();
    project.wsgId = project.ecId = props[0].id;
    project.name = props[0].name;
    return Promise.resolve(project);
  }

  public async createContext(requestContext: AuthorizedClientRequestContext, name: string): Promise<void> {
    requestContext.enter();
    const url: string = this.baseUri + "/sv1.0/Repositories/Global--main/GlobalScope/Context";

    Logger.logInfo(loggerCategory, `Sending POST request to ${url}`);

    const body = { instance: { className: "Context", schemaName: "GlobalScope", properties: { name, id: "", description: "" } } };

    const options: RequestOptions = {
      method: "POST",
      headers: { authorization: requestContext.accessToken.toTokenString() },
      body,
    };

    return request(requestContext, url, options).then(async () => Promise.resolve());
  }

  public async deleteContext(requestContext: AuthorizedClientRequestContext, contextId: string): Promise<void> {
    requestContext.enter();
    const url: string = this.baseUri + "/sv1.0/Repositories/Global--main/GlobalScope/Context/" + contextId;
    requestContext.enter();
    Logger.logInfo(loggerCategory, `Sending DELETE request to ${url}`);

    const options: RequestOptions = {
      method: "DELETE",
      headers: { authorization: requestContext.accessToken.toTokenString() },
    };

    return request(requestContext, url, options).then(async () => Promise.resolve());
  }
}
