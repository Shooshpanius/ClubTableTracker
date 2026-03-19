FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
USER $APP_UID
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS with-node
RUN apt-get update
RUN apt-get install curl
RUN curl -sL https://deb.nodesource.com/setup_20.x | bash
RUN apt-get -y install nodejs

FROM with-node AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY .  ClubTableTracker.Server/
RUN dotnet restore "./ClubTableTracker.Server/ClubTableTracker.Server.csproj"
COPY . .
WORKDIR "/src/ClubTableTracker.Server"
RUN dotnet build "./ClubTableTracker.Server.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./ClubTableTracker.Server.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .

ENTRYPOINT ["dotnet", "ClubTableTracker.Server.dll"]
